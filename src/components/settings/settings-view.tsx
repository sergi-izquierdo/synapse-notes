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
        archived: number;
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
        email: t.settings.providerEmail,
        other: t.settings.providerOther,
    };

    const exportJson = () => {
        startExport(async () => {
            const result = await exportNotesAsJsonAction();
            if (result?.error || !result?.data) {
                toast.error(t.settings.exportFailed, { description: result?.error });
                return;
            }
            const stamp = new Date().toISOString().split("T")[0];
            downloadTextFile(
                `synapse-notes-${stamp}.json`,
                result.data,
                "application/json",
            );
            toast.success(t.settings.exportedJson);
        });
    };

    const exportMarkdown = () => {
        startExport(async () => {
            const result = await exportNotesAsMarkdownAction();
            if (result?.error || !result?.data) {
                toast.error(t.settings.exportFailed, { description: result?.error });
                return;
            }
            const stamp = new Date().toISOString().split("T")[0];
            downloadTextFile(
                `synapse-notes-${stamp}.md`,
                result.data,
                "text/markdown",
            );
            toast.success(t.settings.exportedMarkdown);
        });
    };

    const clearChats = () => {
        startClearing(async () => {
            const result = await clearAllChatsAction();
            if (result?.error) {
                toast.error(t.common.error, { description: result.error });
            } else {
                toast.success(t.settings.clearedChats(counts.chats));
            }
        });
    };

    const deleteAllNotes = () => {
        startDeleting(async () => {
            const result = await deleteAllNotesAction();
            if (result?.error) {
                toast.error(t.common.error, { description: result.error });
            } else {
                toast.success(t.settings.deletedNotes(counts.notes));
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
                                    {t.settings.profile}
                                </CardTitle>
                                <CardDescription>
                                    {t.settings.signedInVia(providerLabel[profile.provider])}
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
                                            {profile.name ?? t.settings.anonymous}
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground font-mono">
                                            {profile.email}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground/70 font-mono uppercase tracking-wider mt-1 tabular-nums">
                                            {t.settings.notesCount(counts.notes)}
                                            {counts.archived > 0
                                                ? ` · ${t.settings.archivedCount(counts.archived)}`
                                                : ""}
                                            {" · "}
                                            {t.settings.chatsCount(counts.chats)}
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
                                        {t.settings.theme}
                                    </Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(
                                            [
                                                {
                                                    value: "light",
                                                    label: t.settings.themeLight,
                                                    icon: Sun,
                                                },
                                                {
                                                    value: "dark",
                                                    label: t.settings.themeDark,
                                                    icon: Moon,
                                                },
                                                {
                                                    value: "system",
                                                    label: t.settings.themeSystem,
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
                                    {t.settings.keyboardShortcuts}
                                </CardTitle>
                                <CardDescription>
                                    {t.settings.keyboardShortcutsDesc}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    variant="outline"
                                    className="w-full justify-between"
                                    onClick={() => setShortcutsOpen(true)}
                                >
                                    {t.settings.openShortcutsOverlay}
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>

                        {/* DATA — export */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Download className="h-5 w-5" />
                                    {t.settings.data}
                                </CardTitle>
                                <CardDescription>
                                    {t.settings.dataDesc}
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
                                    {t.settings.exportJson}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={exportMarkdown}
                                    disabled={isExporting || counts.notes === 0}
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    {t.settings.exportMarkdown}
                                </Button>
                            </CardContent>
                        </Card>

                        {/* TAGS MANAGER */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TagsIcon className="h-5 w-5" />
                                    {t.settings.tags}
                                </CardTitle>
                                <CardDescription>
                                    {t.settings.tagsDesc}
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
                                    {t.settings.session}
                                </CardTitle>
                                <CardDescription>
                                    {t.settings.sessionDesc}
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
                                            {t.settings.signOutAllDevices}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>
                                                {t.settings.signOutEverywhereTitle}
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {t.settings.signOutEverywhereDesc}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>
                                                {t.common.cancel}
                                            </AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={signOutEverywhere}
                                            >
                                                {t.settings.signOutEverywhereConfirm}
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
                                    {t.settings.dangerZone}
                                </CardTitle>
                                <CardDescription>
                                    {t.settings.dangerZoneDesc}
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
                                                {t.settings.clearAllChats}
                                            </span>
                                            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                                                {counts.chats}
                                            </span>
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>
                                                {t.settings.deleteChatsTitle}
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {t.settings.deleteChatsDesc(counts.chats)}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>
                                                {t.common.cancel}
                                            </AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={clearChats}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                                {t.settings.deleteChatsConfirm}
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
                                                {t.settings.deleteEveryNote}
                                            </span>
                                            <span className="font-mono text-[10px] tabular-nums">
                                                {counts.notes}
                                            </span>
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>
                                                {t.settings.deleteNotesTitle}
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {t.settings.deleteNotesDesc(counts.notes)}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>
                                                {t.common.cancel}
                                            </AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={deleteAllNotes}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                                {t.settings.deleteNotesConfirm}
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
