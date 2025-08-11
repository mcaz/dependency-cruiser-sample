import React from "react";
import { Button } from "~components/Atoms";

export const Card: React.FC = () => {
  return (
    <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
      <h2>Card</h2>
      <Button>Click</Button>
    </div>
  );
};
