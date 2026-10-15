import { useQuery } from "@tanstack/react-query";
import { useApi } from "./api";

/** Identidad y rol segun el servidor (nunca segun el navegador). */
export function useMe() {
  const api = useApi();
  return useQuery({ queryKey: ["me"], queryFn: api.me, staleTime: 5 * 60_000, retry: false });
}
