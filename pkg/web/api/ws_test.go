package api

import (
	"testing"
	"time"
)

func TestWsHub(t *testing.T) {
	hub := NewWsHub()
	go hub.run()

	client := &WsClient{
		hub:  hub,
		send: make(chan any, 1),
	}

	// Register
	hub.register <- client

	// Wait a bit for the async register
	time.Sleep(10 * time.Millisecond)

	hub.mu.Lock()
	if _, ok := hub.clients[client]; !ok {
		t.Error("Client was not registered")
	}
	hub.mu.Unlock()

	// Unregister
	hub.unregister <- client
	time.Sleep(10 * time.Millisecond)

	hub.mu.Lock()
	if _, ok := hub.clients[client]; ok {
		t.Error("Client was not unregistered")
	}
	hub.mu.Unlock()
}
