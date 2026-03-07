package core

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/rs/zerolog/log"
)

const (
	DaemonCommandStop   = "stop"
	DaemonCommandStatus = "status"
	DaemonCommandMerge  = "merge"
)

type DaemonCommand struct {
	Command string                `json:"command"`
	Proxies []SysConfigProxyEntry `json:"proxies,omitempty"`
}

type DaemonResponse struct {
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
	Data    any    `json:"data,omitempty"`
}

func DaemonSocketPath() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "/tmp/ihpp.sock"
	}
	return filepath.Join(homeDir, ".ihpp/ihpp.sock")
}

func DaemonPIDPath() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "/tmp/ihpp.pid"
	}
	return filepath.Join(homeDir, ".ihpp/ihpp.pid")
}

func WritePIDFile() error {
	pidPath := DaemonPIDPath()
	if err := os.MkdirAll(filepath.Dir(pidPath), 0755); err != nil {
		return err
	}
	return os.WriteFile(pidPath, []byte(fmt.Sprintf("%d", os.Getpid())), 0644)
}

func RemovePIDFile() {
	_ = os.Remove(DaemonPIDPath())
}

func SendDaemonCommand(cmd DaemonCommand) (*DaemonResponse, error) {
	socketPath := DaemonSocketPath()
	conn, err := net.Dial("unix", socketPath)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	if err := json.NewEncoder(conn).Encode(cmd); err != nil {
		return nil, fmt.Errorf("failed to encode command: %w", err)
	}

	var resp DaemonResponse
	if err := json.NewDecoder(conn).Decode(&resp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &resp, nil
}

func StartDaemonListener(
	onStop func(),
	onMerge func([]SysConfigProxyEntry) any,
	onStatus func() any,
) error {
	socketPath := DaemonSocketPath()

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(socketPath), 0755); err != nil {
		return fmt.Errorf("failed to create socket directory: %w", err)
	}

	// Remove existing socket if any
	_ = os.Remove(socketPath)

	l, err := net.Listen("unix", socketPath)
	if err != nil {
		return fmt.Errorf("failed to listen on unix socket: %w", err)
	}

	log.Info().Str("socket", socketPath).Msg("Daemon IPC listener started")

	go func() {
		defer l.Close()
		for {
			conn, err := l.Accept()
			if err != nil {
				log.Debug().Err(err).Msg("Failed to accept IPC connection")
				continue
			}
			go handleIPCConnection(conn, onStop, onMerge, onStatus)
		}
	}()

	return nil
}

func handleIPCConnection(
	conn net.Conn,
	onStop func(),
	onMerge func([]SysConfigProxyEntry) any,
	onStatus func() any,
) {
	defer conn.Close()
	var cmd DaemonCommand
	if err := json.NewDecoder(conn).Decode(&cmd); err != nil {
		_ = json.NewEncoder(conn).Encode(DaemonResponse{
			Status:  "error",
			Message: "Invalid command format",
		})
		return
	}

	var resp DaemonResponse
	resp.Status = "success"

	switch cmd.Command {
	case DaemonCommandStop:
		resp.Message = "Daemon shutting down"
		_ = json.NewEncoder(conn).Encode(resp)
		onStop()
		return
	case DaemonCommandStatus:
		resp.Data = onStatus()
	case DaemonCommandMerge:
		resp.Data = onMerge(cmd.Proxies)
	default:
		resp.Status = "error"
		resp.Message = fmt.Sprintf("Unknown command: %s", cmd.Command)
	}

	_ = json.NewEncoder(conn).Encode(resp)
}

func Daemonize() error {
	if os.Getenv("IHPP_DAEMON") == "1" {
		return nil
	}

	executable, err := os.Executable()
	if err != nil {
		return err
	}

	args := os.Args[1:]
	// Ensure --daemon is not passed to the child to avoid infinite recursion
	// or just let it be, but IHPP_DAEMON=1 will stop it.

	cmd := exec.Command(executable, args...)
	cmd.Env = append(os.Environ(), "IHPP_DAEMON=1")
	cmd.Stdout = nil
	cmd.Stderr = nil
	cmd.Stdin = nil

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start daemon process: %w", err)
	}

	fmt.Printf("Daemon started with PID %d\n", cmd.Process.Pid)
	os.Exit(0)
	return nil
}

func IsDaemonRunning() bool {
	// 1. Try socket first, it's the most reliable
	_, err := SendDaemonCommand(DaemonCommand{Command: DaemonCommandStatus})
	if err == nil {
		return true
	}

	// 2. Check PID file
	pidPath := DaemonPIDPath()
	if pidData, err := os.ReadFile(pidPath); err == nil {
		var pid int
		if _, err := fmt.Sscanf(string(pidData), "%d", &pid); err == nil {
			if isPIDRunning(pid) {
				// Potential process found, but socket failed
				// Try again one more time with a short timeout
				socketPath := DaemonSocketPath()
				conn, err := net.DialTimeout("unix", socketPath, 100*time.Millisecond)
				if err == nil {
					conn.Close()
					return true
				}
			}
		}
	}

	// 3. Fallback to process name
	return isProcessNameRunning("ihpp")
}

func isPIDRunning(pid int) bool {
	process, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	// On Unix, FindProcess always succeeds. Need to send signal 0.
	err = process.Signal(syscall.Signal(0))
	return err == nil
}

func isProcessNameRunning(name string) bool {
	// Simplified check: iterate /proc on linux or use pgrep
	// For cross-platform or simplicity, pgrep is often easier but let's try a simple linux /proc scan
	files, err := os.ReadDir("/proc")
	if err != nil {
		return false
	}

	myPid := os.Getpid()
	for _, f := range files {
		if !f.IsDir() {
			continue
		}
		pid, err := strconv.Atoi(f.Name())
		if err != nil || pid == myPid {
			continue
		}

		commPath := filepath.Join("/proc", f.Name(), "comm")
		comm, err := os.ReadFile(commPath)
		if err == nil {
			if strings.TrimSpace(string(comm)) == name {
				return true
			}
		}
	}
	return false
}

func CleanupStaleSocket() {
	// If IsDaemonRunning is false, it means either nothing is there or it's stale
	// IsDaemonRunning already tries to be smart.
	// If we are here, it means we've decided to start a new instance.
	_ = os.Remove(DaemonSocketPath())
	_ = os.Remove(DaemonPIDPath())
}
