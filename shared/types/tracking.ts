export type TrackingEventType =
  | "CREATED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "DELAYED"
  | "ISSUE";

export type TrackingEvent = {
  id: string;
  type: TrackingEventType;
  description: string;
  city?: string;
  uf?: string;
  occurredAt: string;
};

export type Tracking = {
  shipmentId: string;
  status: TrackingEventType;
  events: TrackingEvent[];
};
