"use client";

import { ELFlexAntd, useELTheme } from '@/shared/ui';
const Flex = ELFlexAntd;
import { ArrowLeftOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { ELButton } from '@/shared/ui/ELButton';
import { CSSProperties, useEffect } from "react";
import styles from "./QuoteNavigationButtons.module.css";

interface QuoteNavigationButtonsProps {
  /**
   * Callback para o botão Voltar
   */
  onBack?: () => void;

  /**
   * Callback para o botão Avançar
   */
  onNext?: () => void;

  /**
   * Desabilita o botão Voltar (ex: primeiro passo)
   */
  disableBack?: boolean;

  /**
   * Desabilita o botão Avançar (ex: formulário inválido)
   */
  disableNext?: boolean;

  /**
   * Texto customizado para o botão Avançar
   * @default "Próximo"
   */
  nextLabel?: string;

  /**
   * Texto customizado para o botão Voltar
   * @default "Anterior"
   */
  backLabel?: string;

  /**
   * Mostra loading no botão Avançar
   */
  loadingNext?: boolean;

  /**
   * Tipo do botão Avançar
   * @default "primary"
   */
  nextType?: "primary" | "default";
}

export function QuoteNavigationButtons({
  onBack,
  onNext,
  disableBack = false,
  disableNext = false,
  nextLabel = "Próximo",
  backLabel = "Anterior",
  loadingNext = false,
  nextType = "primary",
}: QuoteNavigationButtonsProps) {
  const { token } = useELTheme();

  // Acessibilidade: Enter dispara Avançar, Esc foca Voltar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Enter dispara o botão Avançar se estiver habilitado e não for dentro de um textarea
      if (
        e.key === "Enter" &&
        !disableNext &&
        onNext &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        // Verificar se o target é um botão (evitar double trigger)
        if (e.target instanceof HTMLButtonElement) {
          return;
        }
        e.preventDefault();
        onNext();
      }

      // Esc foca no botão Anterior
      if (e.key === "Escape" && onBack && !disableBack) {
        e.preventDefault();
        const backButton = document.querySelector(
          '[aria-label="Anterior"]'
        ) as HTMLButtonElement;
        backButton?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disableNext, disableBack, onNext, onBack]);

  const containerStyle: CSSProperties = {
    position: "sticky",
    bottom: 0,
    background: token.colorBgContainer,
    borderTop: `1px solid ${token.colorBorder}`,
    padding: "12px 16px",
    marginTop: "24px",
    zIndex: 10,
  };

  return (
    <Flex
      justify="space-between"
      align="center"
      gap={16}
      wrap="wrap"
      style={containerStyle}
      className={styles.quoteNavigationButtons}
    >
      {onBack ? (
        <ELButton
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          disabled={disableBack || loadingNext}
          aria-label="Anterior"
          size="large"
          style={{ minWidth: 120 }}
        >
          {backLabel}
        </ELButton>
      ) : (
        <div />
      )}

      {onNext ? (
        <ELButton
          variant={nextType}
          icon={<ArrowRightOutlined />}
          iconPosition="end"
          onClick={onNext}
          disabled={disableNext}
          loading={loadingNext}
          aria-label="Próximo"
          size="large"
          style={{ minWidth: 120 }}
        >
          {nextLabel}
        </ELButton>
      ) : null}
    </Flex>
  );
}
