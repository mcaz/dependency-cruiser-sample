import React from "react";
import { MoleculesBox } from "~/components/Molecules";

export const Typograph: React.FC<React.PropsWithChildren<{ onClick?: () => void }>> = ({ children, onClick }) => {
  return <>Atoms Typograph<br /><MoleculesBox /></>;
};
