import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function useCurrentTeamMember() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["current-team-member", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, name, email, role, page_permissions")
        .eq("auth_user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
