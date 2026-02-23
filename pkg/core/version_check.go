package core

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

type GitHubRelease struct {
	TagName string `json:"tag_name"`
}

// CheckForUpdates fetches the latest release from GitHub and compares it with the current version.
// If a newer version is available, it returns the tag name of the latest release.
func CheckForUpdates() {
	go func() {
		// Give some time for the server to start and print its initial messages
		time.Sleep(2 * time.Second)

		client := &http.Client{
			Timeout: 5 * time.Second,
		}

		resp, err := client.Get("https://api.github.com/repos/liyu1981/inspect-http-proxy-plus/releases/latest")
		if err != nil {
			log.Debug().Err(err).Msg("Failed to check for updates from GitHub")
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			log.Debug().Str("status", resp.Status).Msg("GitHub API returned non-OK status when checking for updates")
			return
		}

		var release GitHubRelease
		if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
			log.Debug().Err(err).Msg("Failed to decode GitHub release JSON")
			return
		}

		latestVersion := strings.TrimPrefix(release.TagName, "v")
		currentVersion := strings.TrimPrefix(Version, "v")

		GlobalVar.SetLatestVersion(latestVersion, release.TagName)

		if Version != "dev" && latestVersion != currentVersion {
			fmt.Printf("\n%sNew version available: %s%s\n", ColorYellow, release.TagName, ColorReset)
			fmt.Printf("Download it from: https://github.com/liyu1981/inspect-http-proxy-plus/releases/latest\n\n")
		}
	}()
}
