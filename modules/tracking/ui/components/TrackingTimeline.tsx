"use client";

import { ELTimeline, ELTypography, ELCard, ELEmpty } from "@/shared/ui";
const Timeline = ELTimeline;
const Typography = ELTypography;
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  RocketOutlined,
  TruckOutlined,
  WarningOutlined,
} from "@ant-design/icons";

export type TrackingEvent = {
  type: string;
  description: string;
  city?: string | null;
  uf?: string | null;
  occurredAt: string;
};

type TrackingTimelineProps = {
  events: TrackingEvent[];
  title?: string;
};

const EVENT_COLORS: Record<string, string> = {
  POSTED: "blue",
  IN_TRANSIT: "blue",
  OUT_FOR_DELIVERY: "orange",
  DELIVERED: "green",
  EXCEPTION: "red",
  CANCELLED: "red",
};

const EVENT_ICONS: Record<string, React.ReactNode> = {
  POSTED: <RocketOutlined />,
  IN_TRANSIT: <TruckOutlined />,
  OUT_FOR_DELIVERY: <EnvironmentOutlined />,
  DELIVERED: <CheckCircleOutlined />,
  EXCEPTION: <WarningOutlined />,
  CANCELLED: <WarningOutlined />,
};

export function TrackingTimeline({ events, title }: TrackingTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <ELCard title={title}>
        <ELEmpty message="Nenhum evento de rastreamento registrado" />
      </ELCard>
    );
  }

  const timelineItems = events.map((event) => {
    const color = EVENT_COLORS[event.type] || "gray";
    const icon = EVENT_ICONS[event.type] || <ClockCircleOutlined />;

    const location = event.city && event.uf
      ? `${event.city}/${event.uf}`
      : event.city || event.uf || null;

    return {
      color,
      icon: icon,
      content: (
        <div>
          <Typography.Text strong>{event.description}</Typography.Text>
          <br />
          {location && (
            <>
              <Typography.Text type="secondary">
                <EnvironmentOutlined /> {location}
              </Typography.Text>
              <br />
            </>
          )}
          <Typography.Text type="secondary">
            {new Date(event.occurredAt).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </Typography.Text>
        </div>
      ),
    };
  });

  return (
    <ELCard title={title || "Histórico de rastreamento"}>
      <Timeline items={timelineItems} />
    </ELCard>
  );
}
