import React, { ReactNode, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import {
    LayoutDashboard, Users, CheckSquare, Calendar, LogOut, User,
    Moon, Sun, Clock, Settings, Menu, X, ListChecks, FileText, Briefcase, DollarSign, LineChart
} from "lucide-react";
import { getCurrentUser, getUserProfile, signOut, UserRole, getUserRole } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import NotificationBell from "@/components/notifications/NotificationBell";
import { supabase } from "@/integrations/supabase/client";

interface CurrentUser { id: string; email?: string | null; }
interface UserProfile { full_name: string; avatar_url: string | null; }

interface NavItem {
    icon: React.ElementType;
    label: string;
    path: string;
}

interface DashboardLayoutProps {
    children: ReactNode;
    role?: UserRole;
    organizationSection?: string;
    onOrganizationSectionChange?: (section: string) => void;
    tasksSection?: string;
    onTasksSectionChange?: (section: string) => void;
}

// Helper component for rendering sidebar menu items
const SidebarNavItem = ({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: () => void }) => {
    return (
        <Button
            variant={active ? "secondary" : "ghost"}
            className="w-full justify-start font-medium transition-all duration-200 hover:translate-x-0.5 hover:bg-accent/60 rounded-md"
            onClick={onNavigate}
        >
            <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
            <span className="truncate text-sm">{item.label}</span>
        </Button>
    );
};

// Helper component for accordion menu items
const SidebarAccordionItem = ({
    item,
    active,
    isOrgMenu,
    isTasksMenu,
    expandedValue,
    onValueChange,
    onNavigate,
    userRole
}: {
    item: NavItem;
    active: boolean;
    isOrgMenu: boolean;
    isTasksMenu: boolean;
    expandedValue: string | undefined;
    onValueChange: (value: string) => void;
    onNavigate: (path: string, section?: string) => void;
    userRole: UserRole;
}) => {
    const itemKey = isOrgMenu ? 'org-menu' : isTasksMenu ? 'tasks-menu' : '';
    const subMenus = isOrgMenu
        ? [{ id: 'teams', label: 'Đội nhóm' }, { id: 'users', label: 'Người dùng' }, { id: 'shifts', label: 'Ca làm' }, { id: 'attendance', label: 'Chấm công' }, { id: 'salary', label: 'Lương' }, { id: 'statistics', label: 'Thống kê' }]
        : isTasksMenu
            ? [{ id: 'board', label: 'Bảng' }, { id: 'list', label: 'Danh sách' }, { id: 'schedule', label: 'Lịch & Gantt' }, { id: 'roadmap', label: 'Roadmap' }, { id: 'team', label: 'Nhóm' }, { id: 'workload', label: 'Phân Bổ' }, { id: 'goals', label: 'Mục tiêu' }, { id: 'forms', label: 'Biểu mẫu' }, { id: 'development', label: 'Development' }, { id: 'files', label: 'Tài liệu' }, { id: 'reports', label: 'Báo Cáo' }, { id: 'analytics', label: 'Phân tích' }]
            : [];

    return (
        <Accordion type="single" collapsible value={expandedValue || ''} onValueChange={onValueChange}>
            <AccordionItem value={itemKey} className="border-none">
                <AccordionTrigger className={`w-full text-left font-medium text-base transition-all duration-200 px-3 py-2.5 hover:bg-accent/50 rounded-md group ${active ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'}`}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <item.icon className="h-5 w-5 flex-shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-0" />
                        <span className="truncate text-sm">{item.label}</span>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="mt-1 space-y-1 ml-4 pb-2 border-none">
                    {subMenus.map((submenu) => (
                        <Button
                            key={submenu.id}
                            variant={(expandedValue === submenu.id || (isOrgMenu && expandedValue === submenu.id)) ? 'secondary' : 'ghost'}
                            className="w-full justify-start text-sm transition-all duration-200 hover:translate-x-1 hover:bg-accent/60 rounded-md"
                            onClick={() => {
                                onValueChange(submenu.id);
                                onNavigate(item.path, submenu.id);
                            }}
                        >
                            <span className="text-xs">{submenu.label}</span>
                        </Button>
                    ))}
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
};

const DashboardLayout = ({ children, role = 'staff', organizationSection, onOrganizationSectionChange, tasksSection, onTasksSectionChange }: DashboardLayoutProps) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [userRole, setUserRole] = useState<UserRole>(role);
    const [isDark, setIsDark] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [expandedOrg, setExpandedOrgState] = useState(organizationSection || 'teams');
    const [expandedTasks, setExpandedTasksState] = useState(tasksSection || 'board');

    const setExpandedOrg = (value: string) => {
        setExpandedOrgState(value);
        if (onOrganizationSectionChange) onOrganizationSectionChange(value);
    };

    const setExpandedTasks = (value: string) => {
        setExpandedTasksState(value);
        if (onTasksSectionChange) onTasksSectionChange(value);
    };

    const baseMenuItems: NavItem[] = [
        { icon: LayoutDashboard, label: "Bảng điều khiển", path: "/dashboard" },
        { icon: Clock, label: "Chấm công", path: "/attendance" },
        { icon: ListChecks, label: "Công việc", path: "/tasks" },
        { icon: Calendar, label: "Phòng họp", path: "/meeting-rooms" },
        { icon: DollarSign, label: "Lương Thưởng", path: "/payroll" },
    ];

    const menuItems = [...baseMenuItems];
    if (userRole === 'admin') {
        menuItems.push({ icon: Settings, label: "Quản lý Tổ chức", path: "/organization" });
    }

    useEffect(() => {
        if (organizationSection) setExpandedOrgState(organizationSection);
    }, [organizationSection]);

    useEffect(() => {
        if (tasksSection) setExpandedTasksState(tasksSection);
    }, [tasksSection]);

    useEffect(() => {
        const loadUser = async () => {
            const currentUser = await getCurrentUser();
            if (!currentUser) {
                navigate("/auth/login");
                return;
            }

            setUser(currentUser);
            const userProfile = await getUserProfile(currentUser.id);
            setProfile(userProfile);

            const fetchedRole = await getUserRole(currentUser.id);
            setUserRole(fetchedRole);
        };
        loadUser();
    }, [navigate]);

    const handleLogout = async () => {
        const { error } = await signOut();
        if (error) {
            toast({
                variant: "destructive",
                title: "Đăng xuất Thất bại",
                description: error.message
            });
            return;
        }
        navigate("/auth/login");
    };

    const toggleTheme = () => {
        setIsDark(!isDark);
        document.documentElement.classList.toggle("dark");
    };

    const isActive = (path: string) => window.location.pathname.startsWith(path);

    const getInitials = () => {
        if (profile?.first_name && profile?.last_name) {
            return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
        }
        return user?.email?.[0]?.toUpperCase() || "U";
    };

    const getFullName = () => {
        return profile?.full_name || 'Người dùng';
    };

    const getRoleDisplayName = (r: UserRole) => {
        if (r === 'admin') return 'Quản trị';
        if (r === 'leader') return 'Trưởng nhóm';
        return 'Nhân viên';
    };

    const handleSidebarNavigation = (path: string, section?: string) => {
        navigate(path);
        setIsMobileMenuOpen(false);
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Top Navigation */}
            <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-sm shadow-sm">
                <div className="flex h-16 items-center px-4 md:px-6 justify-between gap-4">
                    {/* Logo and App Name */}
                    <div
                        className="flex items-center gap-2 md:gap-3 cursor-pointer flex-1 min-w-0 hover:opacity-80 transition-opacity duration-200"
                        onClick={() => navigate("/dashboard")}
                    >
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center overflow-hidden p-1 shadow-sm flex-shrink-0">
                            <img src="/LOGO.PNG" alt="HRM Logo" className="w-full h-full object-contain" />
                        </div>
                        <div className="hidden sm:block min-w-0">
                            <h1 className="text-lg md:text-xl font-heading font-bold tracking-tight truncate">HRM</h1>
                            <p className="text-xs text-muted-foreground hidden md:block">{getRoleDisplayName(userRole)}</p>
                        </div>
                    </div>

                    {/* Right side controls */}
                    <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                        <NotificationBell />
                        <Button variant="ghost" size="icon" onClick={toggleTheme} className="hidden sm:inline-flex hover:bg-accent/60 transition-colors duration-200">
                            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                        </Button>

                        {/* Mobile Menu Button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden hover:bg-accent/60 transition-colors duration-200"
                        >
                            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </Button>

                        {/* User Dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 hover:bg-accent/60 transition-colors duration-200">
                                    <Avatar>
                                        <AvatarImage src={profile?.avatar_url || undefined} />
                                        <AvatarFallback className="bg-primary text-white font-heading font-semibold text-sm">
                                            {getInitials()}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-semibold">{getFullName()}</p>
                                        <p className="text-xs text-muted-foreground">{user?.email}</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => navigate("/profile")} className="transition-colors duration-150">
                                    <User className="mr-2 h-4 w-4" />
                                    Hồ sơ Cá nhân
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate("/settings")} className="transition-colors duration-150">
                                    <Settings className="mr-2 h-4 w-4" />
                                    Cài đặt
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogout} className="text-destructive transition-colors duration-150">
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Đăng xuất
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar (Desktop) */}
                <aside className="hidden md:flex w-64 flex-col border-r border-border/40 bg-card/50 backdrop-blur-sm overflow-y-auto transition-all duration-300">
                    <nav className="flex-1 space-y-2 p-4 pt-6">
                        {menuItems.map((item) => {
                            const active = isActive(item.path);
                            const isOrgMenu = item.path === "/organization";
                            const isTasksMenu = item.path === "/tasks";

                            if (isOrgMenu && userRole === 'admin') {
                                return (
                                    <SidebarAccordionItem
                                        key={item.path}
                                        item={item}
                                        active={active}
                                        isOrgMenu={true}
                                        isTasksMenu={false}
                                        expandedValue={expandedOrg}
                                        onValueChange={setExpandedOrg}
                                        onNavigate={handleSidebarNavigation}
                                        userRole={userRole}
                                    />
                                );
                            }

                            if (isTasksMenu) {
                                return (
                                    <SidebarAccordionItem
                                        key={item.path}
                                        item={item}
                                        active={active}
                                        isOrgMenu={false}
                                        isTasksMenu={true}
                                        expandedValue={expandedTasks}
                                        onValueChange={setExpandedTasks}
                                        onNavigate={handleSidebarNavigation}
                                        userRole={userRole}
                                    />
                                );
                            }

                            return (
                                <SidebarNavItem
                                    key={item.path}
                                    item={item}
                                    active={active}
                                    onNavigate={() => handleSidebarNavigation(item.path)}
                                />
                            );
                        })}
                    </nav>
                </aside>

                {/* Mobile Sidebar (Overlay) */}
                {isMobileMenuOpen && (
                    <>
                        <div
                            className="fixed inset-0 bg-black/50 md:hidden z-30 animate-fade-in"
                            onClick={() => setIsMobileMenuOpen(false)}
                        />
                        <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-card shadow-lg z-40 overflow-y-auto md:hidden animate-slide-in-left">
                            <nav className="flex flex-col space-y-2 p-4">
                                {menuItems.map((item) => {
                                    const active = isActive(item.path);
                                    const isOrgMenu = item.path === "/organization";
                                    const isTasksMenu = item.path === "/tasks";

                                    if (isOrgMenu && userRole === 'admin') {
                                        return (
                                            <SidebarAccordionItem
                                                key={item.path}
                                                item={item}
                                                active={active}
                                                isOrgMenu={true}
                                                isTasksMenu={false}
                                                expandedValue={expandedOrg}
                                                onValueChange={setExpandedOrg}
                                                onNavigate={handleSidebarNavigation}
                                                userRole={userRole}
                                            />
                                        );
                                    }

                                    if (isTasksMenu) {
                                        return (
                                            <SidebarAccordionItem
                                                key={item.path}
                                                item={item}
                                                active={active}
                                                isOrgMenu={false}
                                                isTasksMenu={true}
                                                expandedValue={expandedTasks}
                                                onValueChange={setExpandedTasks}
                                                onNavigate={handleSidebarNavigation}
                                                userRole={userRole}
                                            />
                                        );
                                    }

                                    return (
                                        <SidebarNavItem
                                            key={item.path}
                                            item={item}
                                            active={active}
                                            onNavigate={() => handleSidebarNavigation(item.path)}
                                        />
                                    );
                                })}
                            </nav>
                        </aside>
                    </>
                )}

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto bg-background/50 pb-20 md:pb-6">
                    <div className="p-4 md:p-6 max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border/40 z-40 shadow-2xl">
                <div className="grid grid-cols-5 gap-0.5 p-1">
                    {menuItems.slice(0, 5).map((item) => {
                        const active = isActive(item.path);
                        return (
                            <Button
                                key={item.path}
                                variant={active ? "secondary" : "ghost"}
                                size="sm"
                                className="flex flex-col h-auto py-2 px-0.5 text-center rounded-sm transition-all duration-200 hover:bg-accent/60"
                                onClick={() => {
                                    navigate(item.path);
                                    setIsMobileMenuOpen(false);
                                }}
                            >
                                <item.icon className="h-5 w-5 mb-1 mx-auto flex-shrink-0" />
                                <span className="text-xs font-medium line-clamp-2">{item.label}</span>
                            </Button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};

export default DashboardLayout;
