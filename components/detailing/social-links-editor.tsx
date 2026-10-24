"use client";
import { useState } from "react";
import type { DetailConfig } from "@/lib/detailing/model";
import "./social-links-editor.css";
const networks = ["MAX", "VK", "Telegram", "WhatsApp", "Другая ссылка"];
const hints: Record<string, string> = {
  MAX: "https://max.ru/…",
  VK: "https://vk.com/…",
  Telegram: "https://t.me/…",
  WhatsApp: "https://wa.me/79991234567",
};
export default function SocialLinksEditor({
  value = [],
  telegram = "",
  onChange,
}: {
  value?: DetailConfig["socialLinks"];
  telegram?: string;
  onChange: (value: DetailConfig["socialLinks"]) => void;
}) {
  const [network, setNetwork] = useState("MAX");
  const links = value.length
    ? value
    : telegram
      ? [{ label: "Telegram", url: telegram }]
      : [];
  const change = (index: number, key: "label" | "url", text: string) =>
    onChange(links.map((x, i) => (i === index ? { ...x, [key]: text } : x)));
  return (
    <div className="sl-editor">
      <h3>Соцсети и мессенджеры</h3>
      {links.map((link, i) => (
        <div className="sl-row" key={i}>
          <label>
            Название ссылки
            <input
              aria-label={`Название соцсети ${i + 1}`}
              maxLength={40}
              value={link.label}
              onChange={(e) => change(i, "label", e.target.value)}
            />
          </label>
          <label>
            Ссылка
            <input
              aria-label={`Ссылка соцсети ${i + 1}`}
              type="url"
              maxLength={2000}
              value={link.url}
              placeholder={hints[link.label] || "https://…"}
              onChange={(e) => change(i, "url", e.target.value)}
            />
          </label>
          <button
            type="button"
            aria-label={`Удалить ссылку ${link.label}`}
            onClick={() => onChange(links.filter((_, j) => i !== j))}
          >
            Удалить
          </button>
        </div>
      ))}
      <div className="sl-add">
        <label>
          Добавить контакт
          <select value={network} onChange={(e) => setNetwork(e.target.value)}>
            {networks.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={links.length >= 8}
          onClick={() =>
            onChange([
              ...links,
              {
                label: network === "Другая ссылка" ? "Написать нам" : network,
                url: "",
              },
            ])
          }
        >
          Добавить ссылку
        </button>
      </div>
      <p>
        Кнопки появятся на сайте после сохранения и публикации. До восьми
        ссылок.
      </p>
    </div>
  );
}
