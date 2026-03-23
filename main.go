package main

import (
	"log"
	"net/http"
	"os"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8290"
	}
	host := os.Getenv("HOST")
	addr := host + ":" + port
	http.Handle("/", http.FileServer(http.Dir(".")))
	log.Printf("[elin-bike] listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}
