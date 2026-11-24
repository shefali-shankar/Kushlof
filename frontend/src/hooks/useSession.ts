import { useQuery } from "@tanstack/react-query";

import { fetchSessionStatus } from "@/api/auth";

export const SESSION_QUERY_KEY = ["session"];

export function useSession() {
  return useQuery({ queryKey: SESSION_QUERY_KEY, queryFn: fetchSessionStatus });
}
