import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserCredentialsRequest {
  email: string;
  full_name: string;
  password: string;
  roles: string[];
  portal_url: string;
}

async function getSuperAdminEmails(): Promise<string[]> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration for fetching super admins');
      return [];
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: superAdmins, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'super_admin')
      .eq('is_active', true);
    
    if (error) {
      console.error('Error fetching super admin emails:', error);
      return [];
    }
    
    const emails = superAdmins?.map(admin => admin.email).filter(Boolean) || [];
    console.log(`Found ${emails.length} super admin(s) to BCC`);
    return emails;
  } catch (error) {
    console.error('Exception fetching super admins:', error);
    return [];
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      email,
      full_name,
      password,
      roles,
      portal_url,
    }: UserCredentialsRequest = await req.json();

    console.log(`Sending credentials email to ${email}`);

    // Validate required fields
    if (!email || !full_name || !password) {
      throw new Error("Missing required fields: email, full_name, or password");
    }

    // Get SMTP configuration from environment
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL");
    const fromName = Deno.env.get("SMTP_FROM_NAME") || "Portal System";

    if (!smtpHost || !smtpUser || !smtpPassword || !fromEmail) {
      throw new Error("SMTP configuration is incomplete. Please check your secrets.");
    }

    // Initialize SMTP transporter with nodemailer
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Format roles for display
    const rolesDisplay = roles.map(role => 
      role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    ).join(', ');

    // Create HTML email template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to the Portal</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #1e293b;
              background: #f8fafc;
              padding: 20px;
            }
            .email-container {
              max-width: 520px;
              margin: 0 auto;
              background: white;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
              color: white;
              padding: 24px;
              text-align: center;
            }
            .header h1 {
              font-size: 24px;
              font-weight: 700;
              margin-bottom: 6px;
              letter-spacing: -0.5px;
            }
            .header p {
              font-size: 14px;
              opacity: 0.95;
              font-weight: 400;
            }
            .content {
              padding: 24px;
              text-align: center;
            }
            .greeting {
              font-size: 16px;
              color: #1e293b;
              margin-bottom: 12px;
            }
            .greeting strong {
              color: #6366f1;
              font-weight: 600;
            }
            .intro-text {
              font-size: 14px;
              color: #64748b;
              margin-bottom: 24px;
              line-height: 1.5;
            }
            .credentials-box {
              background: #f8fafc;
              border-radius: 10px;
              padding: 16px;
              margin: 0 auto 20px;
              max-width: 400px;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            }
            .credentials-box h3 {
              font-size: 16px;
              color: #1e293b;
              margin-bottom: 16px;
              font-weight: 600;
            }
            .credential-item {
              margin: 12px 0;
              text-align: left;
              display: flex;
              flex-direction: column;
              gap: 6px;
            }
            .credential-label {
              font-size: 12px;
              font-weight: 600;
              color: #6366f1;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .credential-value {
              font-family: 'Courier New', monospace;
              background: white;
              padding: 10px 12px;
              border-radius: 6px;
              font-size: 14px;
              color: #1e293b;
              border: 1px solid #e2e8f0;
              word-break: break-all;
            }
            .button {
              display: inline-block;
              padding: 14px 40px;
              background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
              color: white;
              text-decoration: none;
              border-radius: 8px;
              margin: 20px 0;
              font-weight: 600;
              font-size: 15px;
              box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
              transition: all 0.3s ease;
            }
            .button:hover {
              box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
              transform: translateY(-1px);
            }
            .warning {
              background: #fffbeb;
              border: 1px solid #fde68a;
              padding: 12px 16px;
              margin: 20px 0;
              border-radius: 8px;
              font-size: 13px;
              color: #92400e;
              text-align: left;
              max-width: 400px;
              margin-left: auto;
              margin-right: auto;
            }
            .warning strong {
              color: #b45309;
            }
            .help-text {
              font-size: 13px;
              color: #64748b;
              margin: 16px 0;
            }
            .footer {
              text-align: center;
              color: #94a3b8;
              font-size: 12px;
              margin-top: 20px;
              padding: 16px 24px;
              border-top: 1px solid #f1f5f9;
              background: #fafbfc;
            }
            .footer p {
              margin: 4px 0;
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>🎉 Welcome to the Portal!</h1>
              <p>Your account is ready to use</p>
            </div>
            
            <div class="content">
              <p class="greeting">Hi <strong>${full_name}</strong>,</p>
              
              <p class="intro-text">Your account has been created successfully! You can now access the portal with the credentials below.</p>
              
              <div class="credentials-box">
                <h3>Your Login Credentials</h3>
                
                <div class="credential-item">
                  <span class="credential-label">📧 Email Address</span>
                  <div class="credential-value">${email}</div>
                </div>
                
                <div class="credential-item">
                  <span class="credential-label">🔑 Temporary Password</span>
                  <div class="credential-value">${password}</div>
                </div>
                
                <div class="credential-item">
                  <span class="credential-label">👤 Access Level</span>
                  <div class="credential-value">${rolesDisplay}</div>
                </div>
              </div>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong> Please change your password after your first login.
              </div>
              
              <a href="${portal_url}" class="button">Access Portal Dashboard</a>
              
              <p class="help-text">Need help? Contact your system administrator.</p>
              
              <div class="footer">
                <p>This is an automated message. Please do not reply.</p>
                <p>&copy; ${new Date().getFullYear()} ${fromName}. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Plain text version for email clients that don't support HTML
    const textContent = `
Welcome to the Portal!

Hi ${full_name},

Your account has been created and you can now access the portal system.

YOUR LOGIN CREDENTIALS:
- Email: ${email}
- Temporary Password: ${password}
- Access Level: ${rolesDisplay}

IMPORTANT: Please change your password immediately after your first login for security reasons.

Portal URL: ${portal_url}

If you have any questions or need assistance, please contact your system administrator.

This is an automated message. Please do not reply to this email.

© ${new Date().getFullYear()} ${fromName}. All rights reserved.
    `;

    // Fetch super admin emails for BCC
    const superAdminEmails = await getSuperAdminEmails();
    
    // Prepare mail options
    const mailOptions: any = {
      from: `${fromName} <${fromEmail}>`,
      to: email,
      subject: `Welcome to ${fromName} - Your Portal Access`,
      text: textContent,
      html: htmlContent,
    };

    // Add BCC if super admins exist
    if (superAdminEmails.length > 0) {
      mailOptions.bcc = superAdminEmails.join(', ');
      console.log(`BCCing ${superAdminEmails.length} super admin(s): ${superAdminEmails.join(', ')}`);
    }

    // Send email
    await transporter.sendMail(mailOptions);

    console.log(`Credentials email sent successfully to ${email} with ${superAdminEmails.length} super admin(s) BCCed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Credentials email sent successfully",
        recipient: email,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error sending credentials email:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.toString(),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
};

serve(handler);
