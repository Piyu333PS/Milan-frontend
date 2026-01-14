import React, { useState } from "react";
import { searchMilanUsers, sendMilanRequest } from "../lib/api/milan";

export default function MilanSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await searchMilanUsers(query);
      setResults(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (receiverId) => {
    try {
      await sendMilanRequest(receiverId);
      alert("💌 Milan Request Sent!");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to send request");
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <form onSubmit={handleSearch} className="mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or @MilanID"
          className="border w-full p-2 rounded"
        />
      </form>

      {loading && <p>Searching...</p>}

      {results.map((user) => (
        <div
          key={user._id}
          className="flex items-center justify-between py-2 border-b"
        >
          <div className="flex items-center gap-3">
            <img
              src={user.photo || "/default-avatar.png"}
              className="w-10 h-10 rounded-full"
              alt=""
            />
            <div>
              <p className="font-semibold">{user.name}</p>
              <p className="text-sm text-gray-500">
                {user.city} @{user.milanId}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleRequest(user._id)}
            className="bg-pink-500 text-white px-3 py-1 rounded"
          >
            💌 Send Request
          </button>
        </div>
      ))}
    </div>
  );
}
