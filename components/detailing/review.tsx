"use client";
import { useState } from "react";
import { Check, MessageSquare, Smartphone, Monitor } from "lucide-react";
import type { DetailReview } from "@/lib/detailing/model";
import DetailingSite from "./site";
import "./studio.css";
export default function ReviewScreen({
  initial,
}: {
  initial: Omit<DetailReview, "projectId">;
}) {
  const [review, setReview] = useState(initial);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mobile, setMobile] = useState(false);
  const [panel, setPanel] = useState(false);
  async function decide(decision: "approved" | "changes") {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/detailing/reviews/${review.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment }),
      });
      const v = await r.json();
      if (!r.ok) throw new Error(v.error);
      setReview(v.review);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить ответ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ds ds-review">
      <header className="ds-review-bar">
        <div>
          <span className="ds-wordmark">
            FORMA<span> / </span>STUDIO
          </span>
          <p>
            {review.config.name} · версия {review.version}
          </p>
        </div>
        <div className="ds-view-toggle">
          <button
            aria-label="Компьютер"
            aria-pressed={!mobile}
            onClick={() => setMobile(false)}
          >
            <Monitor size={17} />
          </button>
          <button
            aria-label="Телефон"
            aria-pressed={mobile}
            onClick={() => setMobile(true)}
          >
            <Smartphone size={17} />
          </button>
        </div>
        <button className="ds-btn primary" onClick={() => setPanel(!panel)}>
          <MessageSquare size={15} />{" "}
          {review.status === "pending" ? "Оставить ответ" : "Ваш ответ"}
        </button>
      </header>
      <div className="ds-review-note">
        {review.status === "pending"
          ? "Посмотрите сайт и форму записи. Это предпросмотр: заявки не отправляются."
          : review.status === "approved"
            ? "Версия согласована. Команда может опубликовать именно этот вариант."
            : review.status === "changes"
              ? "Вы запросили изменения. Команда получила ваш комментарий."
              : "Сохранена новая версия. Эта ссылка доступна для просмотра, но согласовать её уже нельзя."}
      </div>
      {panel && (
        <section className="ds-review-answer">
          <h2>Согласование версии {review.version}</h2>
          {review.status === "pending" ? (
            <>
              <label>
                Комментарий
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={2000}
                  placeholder="Например, заменить фото или уточнить цены…"
                />
              </label>
              <div className="ds-actions">
                <button
                  className="ds-btn primary"
                  disabled={busy}
                  onClick={() => decide("approved")}
                >
                  <Check size={16} />
                  Согласовать сайт
                </button>
                <button
                  className="ds-btn"
                  disabled={busy || !comment.trim()}
                  onClick={() => decide("changes")}
                >
                  Нужны правки
                </button>
              </div>
            </>
          ) : (
            <p>{review.comment || "Комментарий не добавлен."}</p>
          )}
          {error && (
            <p role="alert" className="ds-error">
              {error}
            </p>
          )}
        </section>
      )}
      <div className={`ds-review-canvas ${mobile ? "mobile" : ""}`}>
        <DetailingSite config={review.config} preview />
      </div>
    </div>
  );
}
