import {
  JsonEditor as JsonEditorReact,
  type JsonEditorProps as JsonEditorReactProps,
} from "json-edit-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

interface JsonEditorProps {
  initialJson: object;
  onChangeJson?: (jsonString: string) => void;
}

export const JsonEditor: React.FC<
  Partial<JsonEditorReactProps> & JsonEditorProps
> = ({ initialJson, onChangeJson, ...restProps }) => {
  console.log("render with:", initialJson);

  const [json, setJson] = useState<object>(initialJson);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);

  const handleSetData = (data: unknown) => {
    setJson(data as object);
    onChangeJson?.(JSON.stringify(data));
  };

  return (
    <div className="relative">
      <div className="absolute top-0 right-0 p-2 z-10">
        <Input
          className={`rounded-2xl bg-white transition-all duration-300 ease-in-out ${
            isSearchFocused ? "w-64" : "w-40"
          }`}
          placeholder="search json fields..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
        />
      </div>
      <JsonEditorReact
        data={json}
        setData={handleSetData}
        showIconTooltips={true}
        collapseAnimationTime={100}
        searchText={searchTerm}
        {...restProps}
      />
    </div>
  );
};
