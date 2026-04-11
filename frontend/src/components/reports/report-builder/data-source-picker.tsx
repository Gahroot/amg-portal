import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DataSource, DataSourceMeta } from "@/types/custom-report";

interface DataSourcePickerProps {
  dataSource: DataSource | "";
  dataSources: DataSourceMeta[] | undefined;
  onChange: (v: DataSource | "") => void;
}

export function DataSourcePicker({
  dataSource,
  dataSources,
  onChange,
}: DataSourcePickerProps) {
  return (
    <div className="flex items-center gap-3">
      <Label className="shrink-0 text-sm font-medium">Data source</Label>
      <Select value={dataSource} onValueChange={(v) => onChange(v as DataSource)}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Choose a data source…" />
        </SelectTrigger>
        <SelectContent>
          {dataSources?.map((ds) => (
            <SelectItem key={ds.key} value={ds.key}>
              {ds.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
