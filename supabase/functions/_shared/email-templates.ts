export const EMAIL_TEMPLATES = {
  welcome: (data: { restaurantName: string, email: string, password: string, loginUrl: string }) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #09090f; color: #f1f5f9; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #111118; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; overflow: hidden; }
        .header { padding: 40px 20px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #06b6d4 100%); }
        .header h1 { margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.05em; }
        .content { padding: 40px; }
        .content h2 { font-size: 20px; font-weight: 700; margin-bottom: 20px; color: #ffffff; }
        .content p { line-height: 1.6; color: #94a3b8; margin-bottom: 20px; }
        .cred-box { background-color: #18181f; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 24px; margin-bottom: 30px; }
        .cred-item { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .cred-label { color: #475569; font-size: 13px; font-weight: 600; text-transform: uppercase; }
        .cred-value { color: #6366f1; font-family: monospace; font-size: 15px; font-weight: 700; }
        .btn { display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff !important; text-decoration: none; border-radius: 10px; font-weight: 700; text-align: center; transition: background-color 0.2s; }
        .footer { padding: 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.05); font-size: 12px; color: #475569; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>AR Menu Platform</h1>
        </div>
        <div class="content">
          <h2>Welcome aboard, ${data.restaurantName}!</h2>
          <p>Your professional AR menu platform is ready. You can now start adding your dishes and viewing them in augmented reality.</p>
          
          <div class="cred-box">
            <div class="cred-item">
              <span class="cred-label">Login Email</span>
              <span class="cred-value">${data.email}</span>
            </div>
            <div class="cred-item">
              <span class="cred-label">Temporary Password</span>
              <span class="cred-value">${data.password}</span>
            </div>
          </div>

          <div style="text-align: center;">
            <a href="${data.loginUrl}" class="btn">Login to Dashboard</a>
          </div>
          
          <p style="margin-top: 30px; font-size: 13px;">Important: For security reasons, please change your password immediately after your first login.</p>
        </div>
        <div class="footer">
          &copy; 2026 AR Menu Platform. All rights reserved.<br>
          Sent with ❤️ from our headquarters.
        </div>
      </div>
    </body>
    </html>
  `,

  loginAlert: (data: { email: string, time: string, device: string, ip: string }) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #09090f; color: #f1f5f9; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #111118; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; overflow: hidden; }
        .header { padding: 25px 20px; text-align: center; background-color: #18181f; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .header h1 { margin: 0; font-size: 18px; font-weight: 800; color: #6366f1; text-transform: uppercase; letter-spacing: 0.1em; }
        .content { padding: 40px; }
        .content h2 { font-size: 20px; font-weight: 700; margin-bottom: 20px; color: #ffffff; }
        .content p { line-height: 1.6; color: #94a3b8; margin-bottom: 20px; }
        .info-box { background-color: #09090f; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin-bottom: 30px; }
        .info-item { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
        .info-label { color: #475569; }
        .info-value { color: #f1f5f9; font-weight: 600; }
        .footer { padding: 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.05); font-size: 12px; color: #475569; }
        .warning { color: #ef4444; font-size: 13px; font-weight: 600; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>AR Menu Security</h1>
        </div>
        <div class="content">
          <h2>New Login Detected</h2>
          <p>We detected a new login to your AR Menu account. If this was you, you can safely ignore this email.</p>
          
          <div class="info-box">
            <div class="info-item">
              <span class="info-label">Account</span>
              <span class="info-value">${data.email}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Time</span>
              <span class="info-value">${data.time}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Device</span>
              <span class="info-value">${data.device}</span>
            </div>
            <div class="info-item">
              <span class="info-label">IP Address</span>
              <span class="info-value">${data.ip}</span>
            </div>
          </div>

          <p class="warning">If you did not authorize this login, please change your password immediately and contact support.</p>
        </div>
        <div class="footer">
          &copy; 2026 AR Menu Platform. Security Department.<br>
          Automated alert — please do not reply.
        </div>
      </div>
    </body>
    </html>
  `,

  signupAlert: (data: { restaurantName: string, ownerName: string, email: string, time: string }) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .header { padding: 30px; background-color: #0f172a; color: #ffffff; text-align: center; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; }
        .content { padding: 40px; }
        .content h2 { font-size: 18px; font-weight: 700; margin-bottom: 20px; color: #0f172a; }
        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .info-table td { padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
        .label { font-weight: 600; color: #64748b; font-size: 13px; text-transform: uppercase; width: 40%; }
        .value { color: #0f172a; font-weight: 700; }
        .footer { padding: 20px; background-color: #f1f5f9; text-align: center; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New SaaS Registration</h1>
        </div>
        <div class="content">
          <h2>A new restaurant has joined the platform!</h2>
          <table class="info-table">
            <tr>
              <td class="label">Restaurant</td>
              <td class="value">${data.restaurantName}</td>
            </tr>
            <tr>
              <td class="label">Owner</td>
              <td class="value">${data.ownerName}</td>
            </tr>
            <tr>
              <td class="label">Email</td>
              <td class="value">${data.email}</td>
            </tr>
            <tr>
              <td class="label">Time</td>
              <td class="value">${data.time}</td>
            </tr>
          </table>
          <p style="font-size: 14px; color: #64748b;">Action Required: Please log in to the Admin Panel to upload menu items for this restaurant.</p>
        </div>
        <div class="footer">
          AR Menu Platform Admin Alerts
        </div>
      </div>
    </body>
    </html>
  `,

  loginConfirmation: (data: { email: string, time: string, device: string, ip: string }) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #05050a; color: #f1f5f9; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #0f0f17; border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
        .header { padding: 40px 20px; text-align: center; background: linear-gradient(135deg, #4f46e5 0%, #0ea5e9 100%); }
        .header h1 { margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.1em; }
        .content { padding: 40px; }
        .content h2 { font-size: 22px; font-weight: 700; margin-bottom: 10px; color: #ffffff; }
        .content p { line-height: 1.6; color: #94a3b8; margin-bottom: 25px; }
        .info-card { background-color: #161622; border: 1px solid rgba(255,255,255,0.03); border-radius: 16px; padding: 25px; margin-bottom: 30px; }
        .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.03); }
        .info-row:last-child { border-bottom: none; }
        .info-label { color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; }
        .info-value { color: #f1f5f9; font-weight: 600; font-size: 14px; }
        .btn-box { text-align: center; margin: 20px 0; }
        .btn { display: inline-block; padding: 12px 30px; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px; }
        .footer { padding: 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.03); font-size: 12px; color: #475569; line-height: 1.5; }
        .accent { color: #38bdf8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>AR Menu Platform</h1>
        </div>
        <div class="content">
          <h2>Successful Sign-in <span class="accent">Confirmed</span></h2>
          <p>Hello! This is a confirmation that your account was successfully accessed. If this was you, no further action is needed.</p>
          
          <div class="info-card">
            <div class="info-row">
              <span class="info-label">Account</span>
              <span class="info-value">${data.email}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Sign-in Time</span>
              <span class="info-value">${data.time}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Device</span>
              <span class="info-value">${data.device}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Location (IP)</span>
              <span class="info-value">${data.ip}</span>
            </div>
          </div>

          <div class="btn-box">
            <a href="https://ar-restaurant-menu-eta.vercel.app/restaurant/index.html" class="btn">Open Dashboard</a>
          </div>

          <p style="font-size: 13px; color: #64748b; text-align: center;">Not you? Secure your account by changing your password immediately.</p>
        </div>
        <div class="footer">
          &copy; 2026 AR Menu Platform. All rights reserved.<br>
          This is an automated security notification.
        </div>
      </div>
    </body>
    </html>
  `,

  loyaltyBirthdayReward: (data: { customerName: string, restaurantName: string, voucherCode: string, voucherValue: string, voucherDesc: string, expiryDate: string }) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #09090f; color: #f1f5f9; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #111118; border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
        .header { padding: 40px 20px; text-align: center; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
        .header h1 { margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.1em; }
        .content { padding: 40px; text-align: center; }
        .content h2 { font-size: 24px; font-weight: 700; margin-bottom: 10px; color: #ffffff; }
        .content p { line-height: 1.6; color: #94a3b8; margin-bottom: 25px; }
        .gift-box { font-size: 4rem; margin: 20px 0; }
        .voucher-card { background: linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.05) 100%); border: 2px dashed #f59e0b; border-radius: 16px; padding: 25px; margin: 30px 0; position: relative; }
        .voucher-title { color: #f59e0b; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .voucher-value { color: #ffffff; font-size: 28px; font-weight: 800; margin: 10px 0; }
        .voucher-code { background-color: #1e1b18; color: #f59e0b; font-family: monospace; font-size: 20px; font-weight: 700; padding: 8px 16px; border-radius: 8px; display: inline-block; border: 1px solid rgba(245,158,11,0.2); margin: 10px 0; }
        .voucher-expiry { color: #64748b; font-size: 12px; margin-top: 10px; }
        .btn { display: inline-block; padding: 14px 32px; background-color: #f59e0b; color: #ffffff !important; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 15px rgba(245,158,11,0.3); }
        .footer { padding: 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.05); font-size: 12px; color: #475569; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Happy Birthday! 🎂</h1>
        </div>
        <div class="content">
          <h2>Dear ${data.customerName || 'Loyal Member'},</h2>
          <p>We wish you a wonderful year filled with happiness, success, and delicious food! To celebrate your special day, <strong>${data.restaurantName}</strong> has sent you a birthday gift.</p>
          
          <div class="gift-box">🎁</div>

          <div class="voucher-card">
            <div class="voucher-title">Birthday Gift Voucher</div>
            <div class="voucher-value">${data.voucherValue}</div>
            <div style="font-size: 14px; color: #94a3b8; margin-bottom: 10px;">${data.voucherDesc}</div>
            <div class="voucher-code">${data.voucherCode}</div>
            <div class="voucher-expiry">Valid until: ${data.expiryDate}</div>
          </div>

          <div style="margin: 25px 0;">
            <a href="https://ar-restaurant-menu-eta.vercel.app/loyalty/dashboard" class="btn">View on Dashboard</a>
          </div>

          <p style="font-size: 13px; color: #64748b; margin-top: 30px;">Present this voucher code to the staff during your next visit to redeem your gift.</p>
        </div>
        <div class="footer">
          &copy; 2026 ${data.restaurantName} Rewards Program.<br>
          You received this email because you opted into rewards from ${data.restaurantName}.
        </div>
      </div>
    </body>
    </html>
  `,

  loyaltyWeeklyPromo: (data: { customerName: string, restaurantName: string, subject?: string, promoMessage?: string, buttonText?: string, buttonUrl?: string, points?: number, offers?: string[] }) => {
    let offersHtml = '';
    if (data.offers && data.offers.length > 0) {
      offersHtml = data.offers.map(o => `<li style="padding:6px 0;">${o}</li>`).join('');
    }
    const pointsText = data.points !== undefined ? `You have <strong style="color:#f59e0b;">${data.points} reward points</strong> waiting for you! Come visit us this weekend and enjoy:` : '';
    const contentHtml = data.promoMessage || `
      <p>Hi ${data.customerName || 'there'},</p>
      <p>${pointsText}</p>
      <ul style="background:rgba(99,102,241,.08);border-radius:12px;padding:16px 16px 16px 36px;line-height:1.8;text-align:left;">${offersHtml}</ul>
    `;
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #09090f; color: #f1f5f9; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #111118; border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
        .header { padding: 40px 20px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); }
        .header h1 { margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.1em; }
        .content { padding: 40px; }
        .content h2 { font-size: 22px; font-weight: 700; margin-bottom: 15px; color: #ffffff; }
        .content p { line-height: 1.6; color: #94a3b8; margin-bottom: 20px; }
        .promo-box { background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.15); border-radius: 16px; padding: 25px; margin: 25px 0; }
        .promo-text { font-size: 15px; color: #e2e8f0; line-height: 1.7; }
        .btn-box { text-align: center; margin: 25px 0; }
        .btn { display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff !important; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 15px rgba(99,102,241,0.3); }
        .footer { padding: 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.05); font-size: 12px; color: #475569; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${data.restaurantName} Rewards</h1>
        </div>
        <div class="content">
          <h2>Hello ${data.customerName || 'Loyal Member'},</h2>
          <p>Here is your weekly update and exclusive offers from <strong>${data.restaurantName}</strong>!</p>
          
          <div class="promo-box">
            <div class="promo-text">${contentHtml}</div>
          </div>

          <div class="btn-box">
            <a href="${data.buttonUrl || 'https://ar-restaurant-menu-eta.vercel.app/loyalty/dashboard'}" class="btn">${data.buttonText || 'Open Dashboard'}</a>
          </div>

          <p style="font-size: 13px; color: #64748b; text-align: center; margin-top: 30px;">We look forward to serving you soon!</p>
        </div>
        <div class="footer">
          &copy; 2026 ${data.restaurantName} Loyalty Club.<br>
          You received this email because you opted into rewards from ${data.restaurantName}.
        </div>
      </div>
    </body>
    </html>
    `
  }
};
