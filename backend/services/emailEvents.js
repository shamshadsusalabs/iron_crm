// Simple SSE event broadcaster for email updates
// Keeps a list of client responses and broadcasts JSON events

const clients = new Set();

function addClient(res) {
  clients.add(res);
}

function removeClient(res) {
  clients.delete(res);
}

function broadcast(eventName, payload) {
  const data = `event: ${eventName}\n` + `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try {
      res.write(data);
    } catch {
      // If write fails, drop the client
      removeClient(res);
    }
  }
}

function initialize() {
  // No initialization needed for this simple implementation
  // This function exists for compatibility
}

module.exports = {
  addClient,
  removeClient,
  broadcast,
  initialize,
};
