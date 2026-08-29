'use client';

import { useState } from 'react';
import {
    X,
    Star,
    Instagram,
    Facebook,
    MessageCircle,
    Send,
    Copy,
    Check,
    MoreHorizontal,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

interface OrderFeedbackShareModalProps {
    open: boolean;
    onClose: () => void;
    orderId?: string;
}

export default function OrderFeedbackShareModal({
    open,
    onClose,
    orderId,
}: OrderFeedbackShareModalProps) {
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [copied, setCopied] = useState(false);

    const { isDark } = useTheme();

    /*
     * Theme colors
     */
    const D = {
        // Main
        bg: isDark ? '#111111' : '#FFFFFF',
        cardBg: isDark ? '#181818' : '#FFFFFF',

        // Text
        text: isDark ? '#FFFFFF' : '#111111',
        mutedText: isDark ? '#A1A1AA' : '#71717A',
        subtleText: isDark ? '#8B8B8B' : '#999999',

        // Borders
        border: isDark ? '#2D2D2D' : '#E5E7EB',
        divider: isDark ? '#292929' : '#EEEEEE',

        // Inputs / buttons
        inputBg: isDark ? '#222222' : '#FAFAFA',
        secondaryBg: isDark ? '#242424' : '#F7F7F7',
        iconBg: isDark ? '#2A2A2A' : '#F1F1F1',

        // Brand
        brand: '#FF5723',
        brandText: '#FFFFFF',

        // Disabled
        disabledBg: isDark ? '#2A2A2A' : '#E5E5E5',
        disabledText: isDark ? '#666666' : '#999999',

        // Star
        starActive: '#FFB300',
        starInactive: isDark ? '#555555' : '#CFCFCF',
    };

    if (!open) return null;

    const shareText = `I just enjoyed my order${orderId ? ` #${orderId}` : ''}! 🍽️`;

    const shareUrl =
        typeof window !== 'undefined'
            ? window.location.href
            : '';

    const handleWhatsApp = () => {
        const url = `https://wa.me/?text=${encodeURIComponent(
            `${shareText}\n${shareUrl}`
        )}`;

        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleFacebook = () => {
        const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
            shareUrl
        )}`;

        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleX = () => {
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
            shareText
        )}&url=${encodeURIComponent(shareUrl)}`;

        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(
                `${shareText}\n${shareUrl}`
            );

            setCopied(true);

            setTimeout(() => {
                setCopied(false);
            }, 2000);
        } catch {
            // Clipboard may not be available in some browsers.
        }
    };

    const handleInstagram = async () => {
        await handleCopy();

        alert(
            'Share text copied. You can paste it on Instagram.'
        );
    };

    const handleSubmit = () => {
        // TODO:
        // Connect this to your feedback API when available.
        console.log({
            orderId,
            rating,
            feedback,
        });

        onClose();
    };

    const isSubmitDisabled = !rating && !feedback.trim();

    /*
     * Theme-aware social button styles
     */
    const socialButtonStyle: React.CSSProperties = {
        border: `1px solid ${D.border}`,
        background: D.inputBg,
        borderRadius: 12,
        padding: '10px 5px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        minHeight: 70,
        fontFamily: "'Poppins', sans-serif",
        color: D.text,
        transition: 'all 0.2s ease',
    };

    const iconCircleStyle: React.CSSProperties = {
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: D.iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: D.text,
    };

    const socialLabelStyle: React.CSSProperties = {
        fontSize: 9,
        fontWeight: 600,
        color: D.mutedText,
    };

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.45)',
                    zIndex: 1000,
                    backdropFilter: 'blur(3px)',
                }}
            />

            {/* Bottom Sheet */}
            {/* Bottom Sheet */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Order feedback and sharing"
                style={{
                    position: 'fixed',
                    left: '50%',
                    bottom: 0,

                    width: '100%',
                    maxWidth: 480,
                    boxSizing: 'border-box',

                    transform: 'translateX(-50%)',

                    zIndex: 1001,

                    background: D.cardBg,
                    color: D.text,

                    borderRadius: '24px 24px 0 0',
                    padding: '22px 20px 28px',

                    boxShadow: isDark
                        ? '0 -8px 30px rgba(0,0,0,0.45)'
                        : '0 -8px 30px rgba(0,0,0,0.18)',

                    maxHeight: '90dvh',
                    overflowY: 'auto',

                    animation: 'slideUpFeedback 0.3s ease-out',

                    fontFamily: "'Poppins', sans-serif",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Handle */}
                <div
                    style={{
                        width: 42,
                        height: 4,
                        borderRadius: 10,
                        background: isDark
                            ? '#444444'
                            : '#D9D9D9',
                        margin: '0 auto 18px',
                    }}
                />

                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 18,
                    }}
                >
                    <div>
                        <h2
                            style={{
                                margin: 0,
                                fontSize: 20,
                                fontWeight: 800,
                                color: D.text,
                            }}
                        >
                            How was your order? 🎉
                        </h2>

                        <p
                            style={{
                                margin: '4px 0 0',
                                fontSize: 12,
                                color: D.mutedText,
                            }}
                        >
                            We'd love to hear your feedback.
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        aria-label="Close"
                        style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            border: `1px solid ${D.border}`,
                            background: D.secondaryBg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                        }}
                    >
                        <X
                            size={18}
                            color={D.mutedText}
                        />
                    </button>
                </div>

                {/* Rating */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        marginBottom: 18,
                    }}
                >
                    <p
                        style={{
                            margin: '0 0 8px',
                            fontSize: 12,
                            fontWeight: 700,
                            color: D.mutedText,
                        }}
                    >
                        Rate your experience
                    </p>

                    <div
                        style={{
                            display: 'flex',
                            gap: 8,
                        }}
                    >
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                onClick={() => setRating(star)}
                                aria-label={`${star} star`}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    padding: 2,
                                    cursor: 'pointer',
                                }}
                            >
                                <Star
                                    size={28}
                                    fill={
                                        star <= rating
                                            ? D.starActive
                                            : 'none'
                                    }
                                    color={
                                        star <= rating
                                            ? D.starActive
                                            : D.starInactive
                                    }
                                />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Feedback */}
                <textarea
                    value={feedback}
                    onChange={(e) =>
                        setFeedback(e.target.value)
                    }
                    placeholder="Tell us about your experience..."
                    rows={3}
                    style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        resize: 'none',
                        borderRadius: 12,

                        border: `1px solid ${D.border}`,
                        background: D.inputBg,
                        color: D.text,

                        padding: '12px 14px',
                        fontFamily: "'Poppins', sans-serif",
                        fontSize: 12,
                        outline: 'none',
                        marginBottom: 16,
                    }}
                />

                {/* Submit */}
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitDisabled}
                    style={{
                        width: '100%',
                        height: 44,
                        borderRadius: 12,
                        border: 'none',

                        background: isSubmitDisabled
                            ? D.disabledBg
                            : D.brand,

                        color: isSubmitDisabled
                            ? D.disabledText
                            : D.brandText,

                        fontSize: 13,
                        fontWeight: 700,

                        cursor: isSubmitDisabled
                            ? 'not-allowed'
                            : 'pointer',

                        fontFamily: "'Poppins', sans-serif",
                        marginBottom: 22,
                        transition: 'all 0.2s ease',
                    }}
                >
                    Submit Feedback
                </button>

                {/* Divider */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 16,
                    }}
                >
                    <div
                        style={{
                            flex: 1,
                            height: 1,
                            background: D.divider,
                        }}
                    />

                    <span
                        style={{
                            fontSize: 11,
                            color: D.subtleText,
                            fontWeight: 600,
                        }}
                    >
                        Share your experience
                    </span>

                    <div
                        style={{
                            flex: 1,
                            height: 1,
                            background: D.divider,
                        }}
                    />
                </div>

                {/* Social Platforms */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns:
                            'repeat(auto-fit, minmax(70px, 1fr))',
                        gap: 10,
                    }}
                >
                    {/* Instagram */}
                    <button
                        onClick={handleInstagram}
                        style={socialButtonStyle}
                    >
                        <span style={iconCircleStyle}>
                            <Instagram size={20} />
                        </span>

                        <span style={socialLabelStyle}>
                            Instagram
                        </span>
                    </button>

                    {/* Facebook */}
                    <button
                        onClick={handleFacebook}
                        style={socialButtonStyle}
                    >
                        <span style={iconCircleStyle}>
                            <Facebook size={20} />
                        </span>

                        <span style={socialLabelStyle}>
                            Facebook
                        </span>
                    </button>

                    {/* WhatsApp */}
                    <button
                        onClick={handleWhatsApp}
                        style={socialButtonStyle}
                    >
                        <span style={iconCircleStyle}>
                            <MessageCircle size={20} />
                        </span>

                        <span style={socialLabelStyle}>
                            WhatsApp
                        </span>
                    </button>

                    {/* X */}
                    <button
                        onClick={handleX}
                        style={socialButtonStyle}
                    >
                        <span style={iconCircleStyle}>
                            <span
                                style={{
                                    fontSize: 18,
                                    fontWeight: 800,
                                }}
                            >
                                𝕏
                            </span>
                        </span>

                        <span style={socialLabelStyle}>
                            X
                        </span>
                    </button>

                    {/* Telegram */}
                    <button
                        onClick={() => {
                            const url = `https://t.me/share/url?url=${encodeURIComponent(
                                shareUrl
                            )}&text=${encodeURIComponent(
                                shareText
                            )}`;

                            window.open(
                                url,
                                '_blank',
                                'noopener,noreferrer'
                            );
                        }}
                        style={socialButtonStyle}
                    >
                        <span style={iconCircleStyle}>
                            <Send size={19} />
                        </span>

                        <span style={socialLabelStyle}>
                            Telegram
                        </span>
                    </button>

                    {/* Copy */}
                    <button
                        onClick={handleCopy}
                        style={socialButtonStyle}
                    >
                        <span style={iconCircleStyle}>
                            {copied ? (
                                <Check size={20} />
                            ) : (
                                <Copy size={20} />
                            )}
                        </span>

                        <span style={socialLabelStyle}>
                            {copied
                                ? 'Copied'
                                : 'Copy Link'}
                        </span>
                    </button>

                    {/* More */}
                    <button
                        onClick={async () => {
                            if (navigator.share) {
                                await navigator.share({
                                    title:
                                        'My Order Experience',
                                    text: shareText,
                                    url: shareUrl,
                                });
                            } else {
                                await handleCopy();
                            }
                        }}
                        style={socialButtonStyle}
                    >
                        <span style={iconCircleStyle}>
                            <MoreHorizontal size={20} />
                        </span>

                        <span style={socialLabelStyle}>
                            More
                        </span>
                    </button>
                </div>

                {/* Skip */}
                <button
                    onClick={onClose}
                    style={{
                        width: '100%',
                        marginTop: 18,
                        border: 'none',
                        background: 'transparent',
                        color: D.subtleText,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 8,
                        fontFamily: "'Poppins', sans-serif",
                    }}
                >
                    Maybe later
                </button>
            </div>

            <style jsx>{`
    @keyframes slideUpFeedback {
        from {
            transform: translate(-50%, 100%);
            opacity: 0;
        }

        to {
            transform: translate(-50%, 0);
            opacity: 1;
        }
    }
`}</style>
        </>
    );
}