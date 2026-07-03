// charts.js — canvas rendering for SOH trend line and cell voltage balance

function drawSohChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  const pl = 35, pr = 15, pt = 15, pb = 20;
  const gw = W - pl - pr;
  const gh = H - pt - pb;

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pt + (gh / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pl, y);
    ctx.lineTo(W - pr, y);
    ctx.stroke();
    const label = (100 - (10 / 4) * i).toFixed(1) + '%';
    ctx.fillStyle = '#64748B';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(label, pl - 8, y + 3);
  }

  if (data.length < 2) return;

  const getX = i => pl + (gw / (data.length - 1)) * i;
  const getY = v => pt + gh * (1 - (v - 90) / 10);

  ctx.beginPath();
  ctx.moveTo(getX(0), getY(data[0]));
  for (let i = 1; i < data.length; i++) {
    const xc = (getX(i - 1) + getX(i)) / 2;
    const yc = (getY(data[i - 1]) + getY(data[i])) / 2;
    ctx.quadraticCurveTo(getX(i - 1), getY(data[i - 1]), xc, yc);
  }
  ctx.lineTo(getX(data.length - 1), getY(data[data.length - 1]));
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  const grad = ctx.createLinearGradient(0, pt, 0, H - pb);
  grad.addColorStop(0, 'rgba(16,185,129,0.25)');
  grad.addColorStop(1, 'rgba(16,185,129,0)');

  ctx.beginPath();
  ctx.moveTo(pl, H - pb);
  ctx.lineTo(getX(0), getY(data[0]));
  for (let i = 1; i < data.length; i++) {
    const xc = (getX(i - 1) + getX(i)) / 2;
    const yc = (getY(data[i - 1]) + getY(data[i])) / 2;
    ctx.quadraticCurveTo(getX(i - 1), getY(data[i - 1]), xc, yc);
  }
  ctx.lineTo(getX(data.length - 1), getY(data[data.length - 1]));
  ctx.lineTo(W - pr, H - pb);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
}

function drawVoltageBalanceChart(canvasId, voltages) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  const pl = 25, pr = 10, pt = 10, pb = 20;
  const gw = W - pl - pr;
  const gh = H - pt - pb;

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = pt + (gh / 3) * i;
    ctx.beginPath();
    ctx.moveTo(pl, y);
    ctx.lineTo(W - pr, y);
    ctx.stroke();
    ctx.fillStyle = '#64748B';
    ctx.font = '8px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText((4.2 - (1.2 / 3) * i).toFixed(1) + 'V', pl - 6, y + 3);
  }

  const n = voltages.length;
  const spacing = 8;
  const barW = (gw - spacing * (n - 1)) / n;
  const minV = 3.0, maxV = 4.25;

  for (let i = 0; i < n; i++) {
    const v = voltages[i];
    const ratio = Math.max(0, (v - minV) / (maxV - minV));
    const bh = gh * ratio;
    const x = pl + (barW + spacing) * i;
    const y = H - pb - bh;

    let fill = '#3B82F6';
    if (v < 3.4) fill = '#EF4444';
    else if (Math.abs(v - 4.12) > 0.15) fill = '#F59E0B';

    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, bh, [4, 4, 0, 0]);
    ctx.fill();

    ctx.fillStyle = '#64748B';
    ctx.font = '8px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('C' + (i + 1), x + barW / 2, H - 6);
  }
}
