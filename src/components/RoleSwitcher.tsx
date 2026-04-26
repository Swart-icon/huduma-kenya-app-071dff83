import { useAuth, type AppRole } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Briefcase, Search, UserCheck, ChevronDown, Check } from "lucide-react";

const roleMeta: Record<Exclude<AppRole, "admin">, { label: string; icon: React.ReactNode }> = {
  provider: { label: "Service Provider", icon: <Briefcase className="w-4 h-4" /> },
  client: { label: "Client", icon: <UserCheck className="w-4 h-4" /> },
  job_seeker: { label: "Job Seeker", icon: <Search className="w-4 h-4" /> },
};

/**
 * Compact dropdown shown only when the user has 2+ non-admin roles.
 * Switches the active dashboard view via AuthContext.switchRole().
 */
export const RoleSwitcher = () => {
  const { role, roles, switchRole } = useAuth();
  const nonAdmin = roles.filter((r): r is Exclude<AppRole, "admin"> => r !== "admin");

  if (nonAdmin.length < 2 || !role || role === "admin") return null;
  const current = roleMeta[role as Exclude<AppRole, "admin">];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 gap-1.5 text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary-foreground/10 text-[11px] rounded-full"
        >
          {current.icon}
          <span className="font-medium">{current.label}</span>
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Switch dashboard</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {nonAdmin.map((r) => (
          <DropdownMenuItem key={r} onClick={() => switchRole(r)} className="gap-2">
            {roleMeta[r].icon}
            <span className="flex-1">{roleMeta[r].label}</span>
            {role === r && <Check className="w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default RoleSwitcher;
