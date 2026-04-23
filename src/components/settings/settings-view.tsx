"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
    ArrowLeft,
    ChevronRight,
    Download,
    Globe,
    Keyboard,
    LogOut,
    Monitor,
    Moon,
    ShieldAlert,
    Sun,
    Tags as TagsIcon,
    Trash2,
    User,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LanguageSwitcher } from "@/components/language-switcher";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";
import {
    clearAllChatsAction,
    deleteAllNotesAction,
    exportNotesAsJsonAction,
    exportNotesAsMarkdownAction,
    signOutEverywhereAction,
} from "@/actions/settings";
import { TagsManager } from "./tags-manager";

type Provider = "google" | "github" | "email" | "other";

export interface SettingsViewProps {
    profile: {
        email: string;
        name: string | null;
        avatarUrl: string | null;
        provider: Provider;
    };
    counts: {
        notes: number;
        chats: number;
    };
    tagCounts: Record<string, number>;
}

// Tiny helper — triggers a browser download for a blob of text without
// us having to pipe through a hidden <a> ref.
function downloadTextFile(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export function SettingsView({
    profile,
    counts,
    tagCounts,
}: SettingsViewProps) {
    const { t } = useLanguage();
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const [isExporting, startExport] = useTransition();
    const [isClearing, startClearing] = useTransition();
    const [isDeleting, startDeleting] = useTransition();
    const [isSigningOut, startSignOut] = useTransition();

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard
        setMounted(true);
    }, []);

    const providerLabel: Record<Provider, string> = {
        google: "Google",
        github: "GitHub",
        email: "Email",
        other: "Provider",
    };

    const exportJson = () => {
        startExport(async () => {
            const result = await exportNotesAsJsonAction();
            if (result?.error || !result?.data) {
                toast.error("Export failed", { description: result?.error });
                return;
            }
            const stamp = new Date().toISOString().split("T")[0];
            downloadTextFile(
                `synapse-notes-${stamp}.json`,
                result.data,
                "application/json",
            );
            toast.success("Exported as JSON");
        });
    };

    const exportMarkdown = () => {
        startExport(async () => {
            const result = await exportNotesAsMarkdownAction();
            if (result?.error || !result?.data) {
                toast.error("Export failed", { description: result?.error });
                return;
            }
            const stamp = new Date().toISOString().split("T")[0];
            downloadTextFile(
                `synapse-notes-${stamp}.md`,
                result.data,
                "text/markdown",
            );
            toast.success("Exported as Markdown");
        });
    };

    const clearChats = () => {
        startClearing(async () => {
            const result = await clearAllChatsAction();
            if (result?.error) {
                toast.error("Error", { description: result.error });
            } else {
                toast.success(`Cleared ${counts.chats} chats`);
            }
        });
    };

    const deleteAllNotes = () => {
        startDeleting(async () => {
            const result = await deleteAllNotesAction();
            if (result?.error) {
                toast.error("Error", { description: result.error });
            } else {
                toast.success(`Deleted ${counts.notes} notes`);
            }
        });
    };

    const signOutEverywhere = () => {
        startSignOut(async () => {
            await signOutEverywhereAction();
        });
    };

    return (
        <div className="flex h-screen w-full overflow-hidden">
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto">
                    <div className="container mx-auto max-w-2xl p-6 space-y-6">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" asChild>
                                <Link href="/">
                                    <ArrowLeft className="h-5 w-5" />
                                </Link>
                            </Button>
                            <h1 className="text-2xl font-bold tracking-tight">
                                {t.settings.title}
                            </h1>
                        </div>

                        {/* PROFILE */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <User className="h-5 w-5" />
                                    Profile
                                </CardTitle>
                                <CardDescription>
                                    Signed in via {providerLabel[profile.provider]}.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-4">
                                    {profile.avatarUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element -- OAuth avatars come from arbitrary origins; next/image would need remote pattern config per provider.
                                        <img
                                            src={profile.avatarUrl}
                                            alt=""
                                            className="h-14 w-14 rounded-full border border-border/60 object-cover"
                                        />
                                    ) : (
                                        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center border border-border/60">
                                            <User className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">
                                            {profile.name ?? "Anonymous"}
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground font-mono">
                                            {profile.email}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground/70 font-mono uppercase tracking-wider mt-1 tabular-nums">
                                            {counts.notes} notes · {counts.chats} chats
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* APPEARANCE — theme picker with 3 options */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Moon className="h-5 w-5" />
                                    {t.settings.appearance}
                                </CardTitle>
                                <CardDescription>
                                    {t.settings.appearance_desc}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">
                                        Theme
                                    </Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(
                                            [
                                                {
                                                    value: "light",
                                                    label: "Light",
                                                    icon: Sun,
                                                },
                                                {
                                                    value: "dark",
                                                    label: "Dark",
                                                    icon: Moon,
                                                },
                                                {
                                                    value: "system",
                                                    label: "System",
                                                    icon: Monitor,
                                                },
                                            ] as const
                                        ).map(({ value, label, icon: Icon }) => {
                                            const active =
                                                mounted && theme === value;
                                            return (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => setTheme(value)}
                                                    aria-pressed={active}
                                                    className={cn(
                                                        "flex flex-col items-center gap-1.5 rounded-md border px-3 py-3 text-xs transition-colors",
                                                        active
                                                            ? "border-primary bg-primary/10 text-foreground"
                                                            : "border-border hover:border-primary/40 text-muted-foreground",
                                                    )}
                                                >
                                                    <Icon className="h-4 w-4" />
                                                    <span className="font-medium">
                                                        {label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* LANGUAGE */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Globe className="h-5 w-5" />
                                    {t.settings.language}
                                </CardTitle>
                                <CardDescription>
                                    {t.settings.language_desc}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <Label>{t.settings.language}</Label>
                                    <LanguageSwitcher />
                                </div>
                            </CardContent>
                        </Card>

                        {/* KEYBOARD SHORTCUTS REFERENCE */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Keyboard className="h-5 w-5" />
                                    Keyboard shortcuts
                                </CardTitle>
                                <CardDescription>
                                    Full reference for every shortcut in the app.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    variant="outline"
                                    className="w-full justify-between"
                                    onClick={() => setShortcutsOpen(true)}
                                >
                                    Open shortcuts overlay
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>

                        {/* DATA — export */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Download className="h-5 w-5" />
                                    Data
                                </CardTitle>
                                <CardDescription>
                                    Export every note as JSON (lossless) or as a
                                    single Markdown file (human-readable).
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={exportJson}
                                    disabled={isExporting || counts.notes === 0}
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    Export JSON
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={exportMarkdown}
                                    disabled={isExporting || counts.notes === 0}
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    Export Markdown
                                </Button>
                            </CardContent>
                        </Card>

                        {/* TAGS MANAGER */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TagsIcon className="h-5 w-5" />
                                    Tags
                                </CardTitle>
                                <CardDescription>
                                    Rename or delete any tag across every note at
                                    once. Renaming to an existing tag merges them.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <TagsManager tagCounts={tagCounts} />
                            </CardContent>
                        </Card>

                        {/* SESSION */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <LogOut className="h-5 w-5" />
                                    Session
                                </CardTitle>
                                <CardDescription>
                                    Revoke every refresh token for this account.
                                    All other devices and browsers will be signed
                                    out immediately.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full"
                                            disabled={isSigningOut}
                                        >
                                            <LogOut className="mr-2 h-4 w-4" />
                                            Sign out of all devices
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>
                                                Sign out everywhere?
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                                You&apos;ll need to log back in on
                                                this device too.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>
                                                Cancel
                                            </AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={signOutEverywhere}
                                            >
                                                Sign out everywhere
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </CardContent>
                        </Card>

                        {/* DANGER ZONE */}
                        <Card className="border-destructive/40">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-destructive">
                                    <ShieldAlert className="h-5 w-5" />
                                    Danger zone
                                </CardTitle>
                                <CardDescription>
                                    These actions are permanent. There is no undo.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-between"
                                            disabled={isClearing || counts.chats === 0}
                                        >
                                            <span className="flex items-center">
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Clear all chats
                                            </span>
                                            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                                                {counts.chats}
                                            </span>
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>
                                                Delete every chat?
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {counts.chats} chats and their
                                                messages will be permanently
                                                removed. Your notes are untouched.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>
                                                Cancel
                                            </AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={clearChats}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                                Delete chats
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>

                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-between border-destructive/60 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                            disabled={isDeleting || counts.notes === 0}
                                        >
                                            <span className="flex items-center">
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete every note
                                            </span>
                                            <span className="font-mono text-[10px] tabular-nums">
                                                {counts.notes}
                                            </span>
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>
                                                Delete every note?
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This wipes {counts.notes} notes
                                                and their embeddings from the
                                                database. You cannot undo this —
                                                export first if you want a copy.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>
                                                Cancel
                                            </AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={deleteAllNotes}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                                Delete all notes
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>

            {/* Shared dialog — opened from the "Keyboard shortcuts" card. */}
            <KeyboardShortcutsDialog
                open={shortcutsOpen}
                onOpenChange={setShortcutsOpen}
            />
        </div>
    );
}
