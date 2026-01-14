import React, { useEffect, useState } from "react";
import {
  getMilanRequests,
  acceptMilanRequest,
  declineMilanRequest,
} from "../lib/api/milan";

export default function MilanRequests() {
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);

  const fetchRequests = async () => {
    try {
      const res = await getMilanRequests();
      setIncoming(res.data.incoming || []);
      setOutgoing(res.data.outgoing || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (id, type) => {
    try {
      if (type === "accept") await acceptMilanRequest(id);
      else await declineMilanRequest(id);
      fetchRequests();
    } catch (err) {
      alert("Action failed");
    }
  };

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-2">💌 Incoming Requests</h3>
      {incoming.length === 0 && <p>No new requests</p>}
      {incoming.map((r) => (
        <div key={r._id} className="flex items-center justify-between border-b py-2">
          <div>
            <p className="font-medium">{r.sender.name}</p>
            <p className="text-sm text-gray-500">
              {r.sender.city} @{r.sender.milanId}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleAction(r._id, "accept")}
              className="bg-green-500 text-white px-3 py-1 rounded"
            >
              ❤️ Accept
            </button>
            <button
              onClick={() => handleAction(r._id, "decline")}
              className="bg-gray-400 text-white px-3 py-1 rounded"
            >
              ❌ Decline
            </button>
          </div>
        </div>
      ))}

      <h3 className="text-lg font-semibold mt-5 mb-2">⏳ Outgoing Requests</h3>
      {outgoing.map((r) => (
        <p key={r._id}>
          Sent to @{r.receiver.milanId} —{" "}
          {r.status === "pending"
            ? "⏳ Waiting"
            : r.status === "accepted"
            ? "❤️ Accepted"
            : "❌ Declined"}
        </p>
      ))}
    </div>
  );
}
