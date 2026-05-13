"use client";

import { createContext, useContext } from "react";

export interface RAUser {
  role: string;
  lab_name: string;
  email: string;
}

export const RAUserContext = createContext<RAUser>({
  role: "ra",
  lab_name: "",
  email: "",
});

export function useRAUser(): RAUser {
  return useContext(RAUserContext);
}
