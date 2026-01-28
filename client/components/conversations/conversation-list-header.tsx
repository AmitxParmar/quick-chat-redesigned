import {
  MessageSquarePlus,
  Moon,
  MoreVertical,
  Sun,
  LogOut,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "../ui/button";
import { useTheme } from "next-themes";
import { useUIStore } from "@/store/ui-store";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useLogout } from "@/hooks/useAuth";
import dynamic from "next/dynamic";
const AccountSwitcher = dynamic(() => import("../common/account-switcher"), {
  ssr: false,
});

const ContactHeader = () => {
  const { theme, setTheme } = useTheme();
  const toggleContactList = useUIStore((state) => state.toggleContactList);
  const router = useRouter();
  const logoutMutation = useLogout();

  const handleLogout = useCallback(() => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        // After logout, redirect to login page
        router.push("/login");
      },
    });
  }, [logoutMutation, router]);

  return (
    <header className="h-16 sticky px-4 py-3 md:grid md:grid-cols-2 items-center justify-around">
      <div className="cursor-pointer pl-2.5 hidden md:block text-2xl font-semibold">
        WhatsApp
      </div>
      <div className="flex justify-end-safe md:gap-1 items-center">
        <AccountSwitcher />
        <div className="flex flex-row items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => toggleContactList()}
          >
            <MessageSquarePlus className="cursor-pointer size-6 -scale-x-100" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger>
              <MoreVertical
                className="text-panel-header-icon cursor-pointer text-xl"
                id="context-opener"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="min-h-full"
                title="change theme"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "light" ? <Moon /> : <Sun />} Switch Theme
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="min-h-full text-red-600"
                title="Logout"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
              >
                <LogOut className="mr-2" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default ContactHeader;
