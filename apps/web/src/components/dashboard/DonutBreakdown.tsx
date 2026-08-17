import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DonutBreakdownProps {
  title: string;
  data: { color: string; value: number; [key: string]: string | number }[];
  labelKey: string;
}

export function DonutBreakdown({ title, data, labelKey }: DonutBreakdownProps) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex h-56 items-center gap-4">
        <div className="h-full min-w-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={2}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 8, borderColor: "var(--border)", fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-1.5 text-sm">
          {data.map((entry) => (
            <li key={String(entry[labelKey])} className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry[labelKey]}</span>
              <span className="font-medium">{total > 0 ? Math.round((entry.value / total) * 100) : 0}%</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
