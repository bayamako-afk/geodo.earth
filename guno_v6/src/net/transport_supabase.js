// guno_v6/src/net/transport_supabase.js
// GUNO V6 Supabase Realtime Transport Layer
//
// Responsibility:
//   - Wrap Supabase Realtime channel for GUNO V6 message passing
//   - Provide a simple send/subscribe interface used by room_client.js
//   - Abstract away Supabase-specific details so the transport can be swapped later
//
// Setup:
//   1. Create a Supabase project at https://supabase.com
//   2. Set SUPABASE_URL and SUPABASE_ANON_KEY in your environment or config file
//   3. Load the Supabase JS client via CDN or npm:
//      <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//
// Usage:
//   const transport = createSupabaseTransport(supabaseUrl, supabaseAnonKey);
//   await transport.connect(roomId);
//   transport.onMessage((msg) => { ... });
//   transport.send({ type: "action:play", ... });
//   transport.disconnect();

"use strict";

/**
 * Create a Supabase Realtime transport for a GUNO V6 room.
 *
 * @param {string} supabaseUrl   - Your Supabase project URL
 * @param {string} supabaseKey   - Your Supabase anon/public key
 * @returns {SupabaseTransport}
 */
export function createSupabaseTransport(supabaseUrl, supabaseKey) {
  // Supabase JS client must be loaded externally (CDN or bundler)
  // window.supabase is set by the CDN script
  const { createClient } = window.supabase ?? {};
  if (!createClient) {
    throw new Error(
      "Supabase JS client not found. Load it via CDN: " +
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
    );
  }

  const client = createClient(supabaseUrl, supabaseKey);
  let channel = null;
  const listeners = [];

  /**
   * Connect to a room channel.
   * @param {string} roomId
   * @returns {Promise<void>}
   */
  async function connect(roomId) {
    if (channel) {
      await disconnect();
    }

    channel = client.channel(`guno-room-${roomId}`, {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "guno-msg" }, ({ payload }) => {
      for (const fn of listeners) {
        try { fn(payload); } catch (e) { console.error("[transport] listener error", e); }
      }
    });

    await new Promise((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
        else if (status === "CHANNEL_ERROR") reject(new Error(`Channel error for room ${roomId}`));
      });
    });
  }

  /**
   * Disconnect from the current room channel.
   * @returns {Promise<void>}
   */
  async function disconnect() {
    if (!channel) return;
    await client.removeChannel(channel);
    channel = null;
  }

  /**
   * Send a message to all participants in the room.
   * @param {object} msg - Message object (will be JSON-serialized internally)
   * @returns {Promise<void>}
   */
  async function send(msg) {
    if (!channel) throw new Error("Not connected to a room");
    await channel.send({
      type: "broadcast",
      event: "guno-msg",
      payload: msg,
    });
  }

  /**
   * Register a callback to receive incoming messages.
   * @param {function(object): void} fn
   */
  function onMessage(fn) {
    listeners.push(fn);
  }

  /**
   * Remove a previously registered message listener.
   * @param {function} fn
   */
  function offMessage(fn) {
    const idx = listeners.indexOf(fn);
    if (idx !== -1) listeners.splice(idx, 1);
  }

  /** @type {SupabaseTransport} */
  return { connect, disconnect, send, onMessage, offMessage };
}

/**
 * @typedef {object} SupabaseTransport
 * @property {function(string): Promise<void>} connect
 * @property {function(): Promise<void>} disconnect
 * @property {function(object): Promise<void>} send
 * @property {function(function): void} onMessage
 * @property {function(function): void} offMessage
 */
