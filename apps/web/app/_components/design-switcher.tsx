"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const designs = [
  { id: 20, label: "Swiss" },
  { id: 23, label: "Architect" },
];

export function DesignSwitcher() {
  const pathname = usePathname();
  const currentId = parseInt(pathname.replace("/", ""), 10);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        display: "flex",
        justifyContent: "center",
        padding: "8px 12px",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(255,255,255,0.1)",
        gap: 6,
        flexWrap: "wrap",
      }}
    >
      {designs.map((d) => {
        const isActive = currentId === d.id;
        return (
          <Link
            key={d.id}
            href={`/${d.id}`}
            title={d.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: "50%",
              fontSize: 12,
              fontWeight: isActive ? 700 : 400,
              fontFamily: "system-ui, -apple-system, sans-serif",
              textDecoration: "none",
              color: isActive ? "#000" : "rgba(255,255,255,0.7)",
              background: isActive
                ? "#fff"
                : "rgba(255,255,255,0.08)",
              border: isActive
                ? "2px solid #fff"
                : "1px solid rgba(255,255,255,0.15)",
              transition: "all 0.2s ease",
              cursor: "pointer",
            }}
          >
            {d.id}
          </Link>
        );
      })}
    </div>
  );
}
