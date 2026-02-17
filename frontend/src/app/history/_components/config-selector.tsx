"use client";

import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ProxyConfig } from "@/types";

interface ConfigSelectorProps {
	configs: ProxyConfig[];
	selectedConfigId: string | null;
	onConfigChange: (id: string) => void;
}

export function formatConfigDisplayName(config: ProxyConfig) {
	let parsedJson: any;
	if (typeof config.config_row.ConfigJSON === "string") {
		try {
			parsedJson = JSON.parse(config.config_row.ConfigJSON);
		} catch (e) {
			parsedJson = {};
		}
	} else {
		parsedJson = config.config_row.ConfigJSON;
	}
	console.log("Parsed ConfigJSON for display name:", parsedJson);
	const listen = parsedJson?.listen || parsedJson?.Listen || "unknown";
	const target = parsedJson?.target || parsedJson?.Target || "unknown";
	return `${listen} 🠞 ${target}`;
}

export function ConfigSelector({
	configs,
	selectedConfigId,
	onConfigChange,
}: ConfigSelectorProps) {
	const selectedConfig = configs.find(
		(c) => c.config_row.ID === selectedConfigId,
	);

	if (configs.length === 0) {
		return null;
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" className="gap-2">
					<span className="font-medium">
						{selectedConfig ? formatConfigDisplayName(selectedConfig) : ""}
					</span>
					<ChevronDown className="h-4 w-4 opacity-50" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				{configs.map((config) => (
					<DropdownMenuItem
						key={config.config_row.ID}
						onClick={() => onConfigChange(config.config_row.ID)}
						className="cursor-pointer"
					>
						<Check
							className={cn(
								"mr-2 h-4 w-4",
								selectedConfigId === config.config_row.ID
									? "opacity-100"
									: "opacity-0",
							)}
						/>
						<span className="truncate">{formatConfigDisplayName(config)}</span>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
