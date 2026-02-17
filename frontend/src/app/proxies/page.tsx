"use client";

import { Loader2, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AppContainer } from "../_components/app-container";
import { AppHeader } from "../_components/app-header";
import { useGlobal } from "../_components/global-app-context";
import { ConfigCard } from "./_components/config-card";
import { CreateProxyCard } from "./_components/create-proxy-card";

export default function ConfigsPage() {
	const { allConfigs, isLoading, refreshConfigs, sysConfig } = useGlobal();
	const [isExporting, setIsExporting] = useState(false);

	// Check if any active proxy is dynamic (not in the current toml file)
	const hasDynamicProxies = useMemo(() => {
		if (!sysConfig?.proxies || !allConfigs.length) return false;

		const normalize = (s: string) => s?.trim().toLowerCase().replace(/\/$/, "");

		return allConfigs.some((config) => {
			try {
				const configJSON = config.config_row.ConfigJSON;
				const parsed =
					typeof configJSON === "string" ? JSON.parse(configJSON) : configJSON;
				const listen = parsed.listen || parsed.Listen;
				const target = parsed.target || parsed.Target;

				return !sysConfig.proxies.some(
					(p: any) =>
						normalize(p.listen || p.Listen) === normalize(listen) &&
						normalize(p.target || p.Target) === normalize(target),
				);
			} catch {
				return false;
			}
		});
	}, [sysConfig, allConfigs]);

	const handleExport = async () => {
		setIsExporting(true);
		try {
			await api.post("/api/proxyserver/export");
			toast.success("Configuration exported to file successfully");
			refreshConfigs();
		} catch (err: any) {
			console.error("Export failed:", err);
			toast.error(
				err.response?.data?.error || "Failed to export configuration",
			);
		} finally {
			setIsExporting(false);
		}
	};

	return (
		<AppContainer>
			<AppHeader>
				<div className="flex items-center justify-between w-full">
					<h1 className="text-xl font-bold tracking-tight text-primary">
						Proxy Servers
					</h1>
					<Button
						variant={hasDynamicProxies ? "default" : "outline"}
						size="sm"
						onClick={handleExport}
						disabled={isExporting}
						title={sysConfig?.config_file}
						className={cn(
							"gap-2 shadow-sm transition-all duration-300",
							hasDynamicProxies &&
								"bg-primary text-primary-foreground ring-2 ring-primary/20 animate-pulse-slow shadow-lg hover:bg-primary/90",
						)}
					>
						{isExporting ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Save className="h-4 w-4" />
						)}
						Export to {sysConfig?.config_file || "Config"}
					</Button>
				</div>
			</AppHeader>

			<div className="flex-1 overflow-auto p-6">
				<div className="max-w-4xl mx-auto space-y-8">
					<CreateProxyCard onSuccess={refreshConfigs} />

					<div className="space-y-6">
						<div className="flex items-center justify-between">
							<h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
								Active & Loaded Proxies ({allConfigs.length})
							</h2>
						</div>

						{isLoading ? (
							<div className="p-10 border border-dashed rounded-xl text-center text-muted-foreground animate-pulse">
								Loading...
							</div>
						) : allConfigs.length === 0 ? (
							<div className="p-10 border border-dashed rounded-xl text-center text-muted-foreground bg-muted/20">
								No active proxy configs.
							</div>
						) : (
							allConfigs.map((config) => (
								<ConfigCard key={config.id} config={config} />
							))
						)}
					</div>
				</div>
			</div>
		</AppContainer>
	);
}
