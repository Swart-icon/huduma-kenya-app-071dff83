// Minimal WebRTC helper for 1-broadcaster -> N-viewer live streaming using
// Supabase as the signaling layer (live_signals table + realtime).
//
// Topology: the broadcaster creates one RTCPeerConnection per viewer,
// sends an 'offer', and exchanges ICE candidates through the signaling table.
// Each viewer sends a 'request_offer' on join, then 'answer' + ICE.

import { supabase } from "@/integrations/supabase/client";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export type SignalRow = {
  id: string;
  stream_id: string;
  from_user_id: string;
  to_user_id: string;
  signal_type: "offer" | "answer" | "ice" | "request_offer";
  payload: any;
  created_at: string;
};

export const sendSignal = async (
  streamId: string,
  fromUserId: string,
  toUserId: string,
  type: SignalRow["signal_type"],
  payload: any
) => {
  await supabase.from("live_signals").insert({
    stream_id: streamId,
    from_user_id: fromUserId,
    to_user_id: toUserId,
    signal_type: type,
    payload,
  });
};

export const subscribeToSignals = (
  streamId: string,
  myUserId: string,
  onSignal: (s: SignalRow) => void
) => {
  const channel = supabase
    .channel(`live-signals-${streamId}-${myUserId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "live_signals",
        filter: `to_user_id=eq.${myUserId}`,
      },
      (payload) => {
        const row = payload.new as SignalRow;
        if (row.stream_id === streamId) onSignal(row);
      }
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
};

export const createPeerConnection = (
  onIce: (candidate: RTCIceCandidateInit) => void,
  onTrack?: (stream: MediaStream) => void
): RTCPeerConnection => {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  pc.onicecandidate = (e) => {
    if (e.candidate) onIce(e.candidate.toJSON());
  };
  if (onTrack) {
    pc.ontrack = (e) => {
      if (e.streams[0]) onTrack(e.streams[0]);
    };
  }
  return pc;
};
