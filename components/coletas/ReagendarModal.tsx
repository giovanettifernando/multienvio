"use client";

import { useState } from "react";
import { Modal, DatePicker, Form, Flex } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useReagendarColeta } from "@/lib/coletas/hooks";
import type { Coleta } from "@/lib/coletas/types";
import { spacing } from "@/lib/ui/theme";

interface ReagendarModalProps {
  coleta: Coleta | null;
  open: boolean;
  onClose: () => void;
}

export function ReagendarModal({
  coleta,
  open,
  onClose,
}: ReagendarModalProps) {
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const reagendarMutation = useReagendarColeta();

  const handleOk = async () => {
    if (!coleta || !selectedDate) return;

    await reagendarMutation.mutateAsync({
      id: coleta.id,
      data: {
        scheduledFor: selectedDate.format("YYYY-MM-DD"),
      },
    });

    handleClose();
  };

  const handleClose = () => {
    setSelectedDate(null);
    onClose();
  };

  const disabledDate = (current: Dayjs) => {
    // Disable dates before today
    return current && current.isBefore(dayjs().startOf("day"));
  };

  return (
    <Modal
      title="Reagendar Coleta"
      open={open}
      onOk={handleOk}
      onCancel={handleClose}
      okText="Reagendar"
      cancelText="Cancelar"
      confirmLoading={reagendarMutation.isPending}
      okButtonProps={{ disabled: !selectedDate }}
    >
      {coleta && (
        <Flex vertical gap={spacing.lg}>
          <Form.Item label="Rastreio" style={{ marginBottom: 0 }}>
            <strong>{coleta.trackingCode}</strong>
          </Form.Item>

          <Form.Item label="Data Atual" style={{ marginBottom: 0 }}>
            {dayjs(coleta.scheduledFor).format("DD/MM/YYYY")}
          </Form.Item>

          <Form.Item
            label="Nova Data da Coleta"
            required
            help="Selecione uma data a partir de hoje"
          >
            <DatePicker
              value={selectedDate}
              onChange={setSelectedDate}
              disabledDate={disabledDate}
              format="DD/MM/YYYY"
              placeholder="Selecione a data"
              style={{ width: "100%" }}
            />
          </Form.Item>
        </Flex>
      )}
    </Modal>
  );
}
