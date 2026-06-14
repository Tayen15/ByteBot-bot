const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

try {
  GlobalFonts.registerFromPath(path.join(__dirname, '../assets/fonts/gg-sans.ttf'), 'gg sans');
  GlobalFonts.registerFromPath(path.join(__dirname, '../assets/fonts/gg-sans.ttf'), 'Discord');
} catch (e) {
  console.warn('⚠️ Failed to load custom font gg-sans.ttf:', e.message);
}

/**
 * Generate custom welcome image with user avatar and configurable design
 * @param {Object} options - Configuration options
 * @param {string} options.username - User's display name
 * @param {string} options.avatarUrl - URL to user's avatar
 * @param {string} options.layout - Layout style (simple, left, right, text)
 * @param {string} options.bgImageUrl - Background image URL
 * @param {string} options.bgColor - Background color fallback
 * @param {string} options.circleColor - Avatar border color
 * @param {string} options.titleColor - "WELCOME" title color
 * @param {string} options.usernameColor - Username text color
 * @param {string} options.messageColor - Message text color
 * @param {string} options.overlayColor - Overlay color
 * @param {number} options.overlayOpacity - Overlay opacity (0-100)
 * @param {string} options.avatarShape - Avatar shape (circle or square)
 * @param {string} options.font - Font name (gg sans, Arial, Helvetica, Impact, etc)
 * @param {number} options.memberCount - Server member count
 * @param {string} options.memberCountText - Custom text template for member count
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function generateWelcomeImage(options) {
  const {
    username = 'User',
    avatarUrl,
    layout = 'simple',
    bgImageUrl,
    bgColor = '#23272A',
    circleColor = '#FFFFFF',
    titleColor = '#FFFFFF',
    usernameColor = '#FFFFFF',
    messageColor = '#B9BBBE',
    overlayColor = '#000000',
    overlayOpacity = 50,
    avatarShape = 'circle',
    font = 'gg sans',
    memberCount = 0,
    memberCountText = 'You are the {count}th member!'
  } = options;

  const width = 1024;
  const height = 500;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const FONT_MAP = {
    'gg sans': '"gg sans", Arial, sans-serif',
    'Discord': '"Discord", Arial, sans-serif',
    'Helvetica': 'Helvetica, Arial, sans-serif',
    'Impact': 'Impact, Arial Black, sans-serif',
    'Georgia': 'Georgia, serif',
    'Courier New': 'Courier New, monospace',
    'Comic Sans MS': 'Comic Sans MS, cursive',
    'Verdana': 'Verdana, sans-serif',
    'Times New Roman': 'Times New Roman, serif',
    'Arial': 'Arial, sans-serif'
  };

  const fontFamily = FONT_MAP[font] || 'Arial, sans-serif';

  // Draw background
  if (bgImageUrl) {
    try {
      const bgImage = await loadImage(bgImageUrl);
      ctx.drawImage(bgImage, 0, 0, width, height);
    } catch (err) {
      console.warn('⚠️ Failed to load background image, using color fallback');
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
  }

  // Draw overlay
  if (overlayOpacity > 0) {
    ctx.fillStyle = hexToRGBA(overlayColor, overlayOpacity / 100);
    ctx.fillRect(0, 0, width, height);
  }

  // Layout-specific rendering with new layouts
  if (layout === 'simple') {
    await drawSimpleLayout(ctx, { username, avatarUrl, circleColor, titleColor, usernameColor, messageColor, avatarShape, width, height, fontFamily, memberCount, memberCountText });
  } else if (layout === 'left') {
    await drawLeftLayout(ctx, { username, avatarUrl, circleColor, titleColor, usernameColor, messageColor, avatarShape, width, height, fontFamily, memberCount, memberCountText });
  } else if (layout === 'right') {
    await drawRightLayout(ctx, { username, avatarUrl, circleColor, titleColor, usernameColor, messageColor, avatarShape, width, height, fontFamily, memberCount, memberCountText });
  } else if (layout === 'text') {
    await drawTextLayout(ctx, { username, titleColor, usernameColor, messageColor, width, height, fontFamily, memberCount, memberCountText });
  } else {
    // Fallback to simple for legacy layouts
    await drawSimpleLayout(ctx, { username, avatarUrl, circleColor, titleColor, usernameColor, messageColor, avatarShape, width, height, fontFamily, memberCount, memberCountText });
  }

  return canvas.toBuffer('image/png');
}

// Simple Layout: Avatar center top, text below centered
async function drawSimpleLayout(ctx, options) {
  const { username, avatarUrl, circleColor, titleColor, usernameColor, messageColor, avatarShape, width, height, fontFamily, memberCount, memberCountText } = options;
  const centerX = width / 2;

  // Avatar (top center)
  const avatarSize = 180;
  const avatarY = 130;

  if (avatarUrl) {
    try {
      const avatar = await loadImage(avatarUrl);
      ctx.save();

      if (avatarShape === 'circle') {
        ctx.beginPath();
        ctx.arc(centerX, avatarY, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, centerX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
        ctx.restore();

        ctx.strokeStyle = circleColor;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(centerX, avatarY, avatarSize / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const radius = 15;
        ctx.beginPath();
        roundRect(ctx, centerX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize, radius);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, centerX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
        ctx.restore();

        ctx.strokeStyle = circleColor;
        ctx.lineWidth = 5;
        ctx.beginPath();
        roundRect(ctx, centerX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize, radius);
        ctx.stroke();
      }
    } catch (err) {
      console.warn('⚠️ Failed to load avatar');
      drawPlaceholderAvatar(ctx, centerX, avatarY, avatarSize, circleColor, avatarShape);
    }
  } else {
    drawPlaceholderAvatar(ctx, centerX, avatarY, avatarSize, circleColor, avatarShape);
  }

  // Text below
  ctx.textAlign = 'center';

  ctx.fillStyle = titleColor;
  ctx.font = `bold 48px ${fontFamily}`;
  ctx.fillText('WELCOME', centerX, 310);

  ctx.fillStyle = usernameColor;
  ctx.font = `bold 40px ${fontFamily}`;
  ctx.fillText(username, centerX, 370);

  if (memberCountText) {
    ctx.fillStyle = messageColor;
    ctx.font = `28px ${fontFamily}`;
    ctx.fillText(memberCountText, centerX, 420);
  }
}

// Left Layout: Avatar left, text to the right
async function drawLeftLayout(ctx, options) {
  const { username, avatarUrl, circleColor, titleColor, usernameColor, messageColor, avatarShape, width, height, fontFamily, memberCount, memberCountText } = options;

  const avatarSize = 200;
  const avatarX = 150;
  const avatarY = height / 2;
  const textX = 320;

  if (avatarUrl) {
    try {
      const avatar = await loadImage(avatarUrl);
      ctx.save();

      if (avatarShape === 'circle') {
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
        ctx.restore();

        ctx.strokeStyle = circleColor;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const radius = 15;
        ctx.beginPath();
        roundRect(ctx, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize, radius);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
        ctx.restore();

        ctx.strokeStyle = circleColor;
        ctx.lineWidth = 5;
        ctx.beginPath();
        roundRect(ctx, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize, radius);
        ctx.stroke();
      }
    } catch (err) {
      drawPlaceholderAvatar(ctx, avatarX, avatarY, avatarSize, circleColor, avatarShape);
    }
  } else {
    drawPlaceholderAvatar(ctx, avatarX, avatarY, avatarSize, circleColor, avatarShape);
  }

  // Text to the right
  ctx.textAlign = 'left';

  ctx.fillStyle = titleColor;
  ctx.font = `bold 50px ${fontFamily}`;
  ctx.fillText('WELCOME', textX, height / 2 - 40);

  ctx.fillStyle = usernameColor;
  ctx.font = `bold 42px ${fontFamily}`;
  ctx.fillText(username, textX, height / 2 + 20);

  if (memberCountText) {
    ctx.fillStyle = messageColor;
    ctx.font = `30px ${fontFamily}`;
    ctx.fillText(memberCountText, textX, height / 2 + 70);
  }
}

// Right Layout: Avatar right, text to the left
async function drawRightLayout(ctx, options) {
  const { username, avatarUrl, circleColor, titleColor, usernameColor, messageColor, avatarShape, width, height, fontFamily, memberCount, memberCountText } = options;

  const avatarSize = 200;
  const avatarX = width - 150;
  const avatarY = height / 2;
  const textX = width - 320;

  if (avatarUrl) {
    try {
      const avatar = await loadImage(avatarUrl);
      ctx.save();

      if (avatarShape === 'circle') {
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
        ctx.restore();

        ctx.strokeStyle = circleColor;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const radius = 15;
        ctx.beginPath();
        roundRect(ctx, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize, radius);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
        ctx.restore();

        ctx.strokeStyle = circleColor;
        ctx.lineWidth = 5;
        ctx.beginPath();
        roundRect(ctx, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize, radius);
        ctx.stroke();
      }
    } catch (err) {
      drawPlaceholderAvatar(ctx, avatarX, avatarY, avatarSize, circleColor, avatarShape);
    }
  } else {
    drawPlaceholderAvatar(ctx, avatarX, avatarY, avatarSize, circleColor, avatarShape);
  }

  // Text to the left
  ctx.textAlign = 'right';

  ctx.fillStyle = titleColor;
  ctx.font = `bold 50px ${fontFamily}`;
  ctx.fillText('WELCOME', textX, height / 2 - 40);

  ctx.fillStyle = usernameColor;
  ctx.font = `bold 42px ${fontFamily}`;
  ctx.fillText(username, textX, height / 2 + 20);

  if (memberCountText) {
    ctx.fillStyle = messageColor;
    ctx.font = `30px ${fontFamily}`;
    ctx.fillText(memberCountText, textX, height / 2 + 70);
  }
}

// Text Only Layout: No avatar, text centered
async function drawTextLayout(ctx, options) {
  const { username, titleColor, usernameColor, messageColor, width, height, fontFamily, memberCount, memberCountText } = options;
  const centerX = width / 2;

  ctx.textAlign = 'center';

  ctx.fillStyle = titleColor;
  ctx.font = `bold 50px ${fontFamily}`;
  ctx.fillText('WELCOME', centerX, height / 2 - 40);

  ctx.fillStyle = usernameColor;
  ctx.font = `bold 42px ${fontFamily}`;
  ctx.fillText(username, centerX, height / 2 + 20);

  if (memberCountText) {
    ctx.fillStyle = messageColor;
    ctx.font = `30px ${fontFamily}`;
    ctx.fillText(memberCountText, centerX, height / 2 + 70);
  }
}

function drawPlaceholderAvatar(ctx, x, y, size, color, shape) {
  if (shape === 'circle') {
    ctx.fillStyle = '#36393F';
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.stroke();

    // Draw user icon
    ctx.fillStyle = color;
    ctx.font = `${size / 2}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👤', x, y);
  } else {
    const radius = 20;
    ctx.fillStyle = '#36393F';
    ctx.beginPath();
    roundRect(ctx, x - size / 2, y - size / 2, size, size, radius);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = `${size / 2}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👤', x, y);
  }
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}

function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

module.exports = { generateWelcomeImage };
