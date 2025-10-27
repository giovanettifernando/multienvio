"use client";

import { useEffect, useState } from "react";
import { Drawer } from "antd";
import { TicketDetails } from "./TicketDetails";

interface TicketSlideOverProps {
  open: boolean;
  ticketId?: string | null;
  viewerId?: string;
  onClose: () => void;
}

export function TicketSlideOver({ open, ticketId, viewerId, onClose }: TicketSlideOverProps) {
  const [drawerWidth, setDrawerWidth] = useState(720);
  const headingId = ticketId ? `ticket-drawer-${ticketId}` : undefined;

  useEffect(() => {
    const updateWidth = () => {
      if (typeof window === "undefined") return;
      const vw = window.innerWidth;
      const computed = Math.min(720, Math.round(vw * 0.9));
      setDrawerWidth(computed);
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    if (!open || !headingId) return;
    const timer = window.setTimeout(() => {
      const element = document.getElementById(headingId);
      element?.focus();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [open, headingId]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      destroyOnClose
      width={drawerWidth}
      maskClosable
      styles={{
        body: { padding: 0 },
      }}
    >
      <div style={{ padding: 24, minHeight: "100%", background: "#fff" }}>
        <TicketDetails ticketId={ticketId} viewerId={viewerId} headingId={headingId} />
      </div>
    </Drawer>
  );
}
