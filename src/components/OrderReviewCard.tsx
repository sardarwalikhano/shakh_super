import { useEffect, useState } from 'react';
import { CheckCircle2, MessageSquareText, Send, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export default function OrderReviewCard({
  userId,
  orderId,
  storeId,
  storeName,
  eligible,
}: {
  userId: string;
  orderId: string;
  storeId: string | null;
  storeName?: string | null;
  eligible: boolean;
}) {
  const [existing, setExisting] = useState<ReviewRow | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setExisting(null);
    setRating(0);
    setComment('');
    setMessage(null);
    if (!eligible || !userId || !orderId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void supabase
      .from('reviews')
      .select('id,rating,comment,created_at')
      .eq('user_id', userId)
      .eq('order_id', orderId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setMessage('نەتوانرا هەڵسەنگاندنی ئەم ئۆردەرە بار بکرێت.');
        } else {
          setExisting((data as ReviewRow | null) ?? null);
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [eligible, orderId, userId]);

  const submit = async () => {
    if (!eligible || !storeId || rating < 1 || rating > 5 || saving) return;
    setSaving(true);
    setMessage(null);

    const { data, error } = await supabase
      .from('reviews')
      .insert({
        user_id: userId,
        order_id: orderId,
        store_id: storeId,
        rating,
        comment: comment.trim() || null,
      })
      .select('id,rating,comment,created_at')
      .single();

    if (error) {
      setMessage(error.code === '23505'
        ? 'ئەم ئۆردەرە پێشتر هەڵسەنگێندراوە.'
        : error.message || 'نەتوانرا هەڵسەنگاندن تۆمار بکرێت.');
    } else {
      setExisting(data as ReviewRow);
      setMessage('سوپاس! هەڵسەنگاندنەکەت تۆمار کرا.');
    }
    setSaving(false);
  };

  if (!eligible) return null;

  return (
    <section className="orderReviewCard" aria-labelledby={`order-review-${orderId}`}>
      <div className="orderReviewHead">
        <div>
          <span className="customer-orders-panel__eyebrow"><MessageSquareText size={15} /> هەڵسەنگاندنی ئۆردەر</span>
          <h3 id={`order-review-${orderId}`}>چۆن خزمەتگوزارییەکە بوو؟</h3>
          <p>{storeName ? `هەڵسەنگاندنی ${storeName}` : 'هەڵسەنگاندنی خزمەتگوزاریی ئەم ئۆردەرە'}</p>
        </div>
        <Star size={28} />
      </div>

      {loading ? (
        <div className="orderReviewLoading">چاوەڕوان بە...</div>
      ) : existing ? (
        <div className="orderReviewSubmitted" role="status">
          <div className="orderReviewStars" aria-label={`نمرەی ${existing.rating} لە ٥`}>
            {Array.from({ length: 5 }, (_, index) => (
              <Star key={index} size={21} fill={index < existing.rating ? 'currentColor' : 'none'} />
            ))}
          </div>
          <div>
            <strong>هەڵسەنگاندنەکەت تۆمار کراوە</strong>
            {existing.comment && <p>{existing.comment}</p>}
            <small><CheckCircle2 size={14} /> {new Date(existing.created_at).toLocaleString('ku-IQ')}</small>
          </div>
        </div>
      ) : (
        <>
          <div className="orderReviewStars" role="radiogroup" aria-label="هەڵبژاردنی نمرە">
            {Array.from({ length: 5 }, (_, index) => {
              const value = index + 1;
              return (
                <button
                  key={value}
                  type="button"
                  className={value <= rating ? 'is-active' : ''}
                  onClick={() => setRating(value)}
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} لە ٥`}
                >
                  <Star size={27} fill={value <= rating ? 'currentColor' : 'none'} />
                </button>
              );
            })}
          </div>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value.slice(0, 1000))}
            placeholder="بۆچوونەکەت بنووسە (ئاختیاری)..."
            maxLength={1000}
            rows={4}
          />
          <div className="orderReviewFooter">
            <small>{comment.length.toLocaleString('ku-IQ')} / ١٠٠٠</small>
            <button type="button" className="primary" disabled={rating < 1 || saving || !storeId} onClick={() => void submit()}>
              <Send size={16} /> {saving ? 'تۆمارکردن...' : 'ناردنی هەڵسەنگاندن'}
            </button>
          </div>
        </>
      )}

      {message && <div className="orderReviewMessage">{message}</div>}
    </section>
  );
}
