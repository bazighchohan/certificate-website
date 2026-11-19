"use client";

import { useState } from "react";
import AdminUploadClient from "./AdminUploadClient";
import SocietyUploadBox from "./SocietyUploadBox";
import AttendeesManager from "./AttendeesManager";

export default function AdminContentWrapper() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-8">
      {/* Upload Attendees (Main Unified CSV) */}
      <AdminUploadClient onUploadSuccess={handleRefresh} />

      {/* Optional: Upload Society Members List */}
      <SocietyUploadBox onSyncSuccess={handleRefresh} />

      {/* Registered Attendees (Grouped by person, society toggle, edit & delete) */}
      <AttendeesManager key={refreshKey} />
    </div>
  );
}
