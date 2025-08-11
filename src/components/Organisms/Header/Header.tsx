import React from "react";
import { Button } from "~components/Atoms/Button/Button";

export const Header: React.FC = () => {
  return (
    <header style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderBottom: "1px solid #eee" }}>
      <strong>Header</strong>
      <Button>Action</Button>
    </header>
  );
};
