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

    // Get portal URL from business settings if not provided
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    let finalPortalUrl = portal_url;
    
    if (!finalPortalUrl || finalPortalUrl === '') {
      const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
      
      const { data: settingData, error: settingError } = await supabase
        .from('api_settings')
        .select('setting_value')
        .eq('setting_key', 'PORTAL_URL')
        .single();
      
      if (!settingError && settingData) {
        finalPortalUrl = settingData.setting_value;
        console.log(`Using portal URL from business settings: ${finalPortalUrl}`);
      } else {
        // Fallback to default
        finalPortalUrl = 'https://your-portal.com';
        console.warn('No portal URL found in settings, using fallback');
      }
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
              color: #111827;
              background: #f9fafb;
              padding: 20px;
            }
            .email-container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              border-radius: 8px;
              overflow: hidden;
              border: 1px solid #e5e7eb;
            }
            .header {
              background: #4F46E5;
              color: white;
              padding: 32px 32px 28px;
            }
            .header h1 {
              font-size: 24px;
              font-weight: 600;
              margin: 0;
              letter-spacing: -0.3px;
            }
            .content {
              padding: 32px;
            }
            .greeting {
              font-size: 16px;
              color: #111827;
              margin-bottom: 16px;
              line-height: 1.5;
            }
            .intro-text {
              font-size: 15px;
              color: #6b7280;
              margin-bottom: 24px;
              line-height: 1.6;
            }
            .credentials-box {
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 20px 24px;
              margin-bottom: 24px;
            }
            .credentials-box h3 {
              font-size: 14px;
              color: #111827;
              margin-bottom: 16px;
              font-weight: 600;
              letter-spacing: -0.2px;
            }
            .credential-line {
              font-size: 14px;
              color: #374151;
              margin: 10px 0;
              line-height: 1.6;
            }
            .credential-line strong {
              color: #111827;
              font-weight: 600;
            }
            .credential-line code {
              font-family: 'SF Mono', 'Courier New', monospace;
              background: white;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 13px;
              color: #111827;
              border: 1px solid #e5e7eb;
            }
            .button-container {
              margin: 28px 0;
            }
            .button {
              display: inline-block;
              padding: 12px 32px;
              background: #4F46E5 !important;
              color: #ffffff !important;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 500;
              font-size: 15px;
              transition: background 0.2s ease;
              -webkit-text-fill-color: #ffffff;
              mso-line-height-rule: exactly;
            }
            .button:hover {
              background: #4338CA !important;
            }
            .warning {
              background: #fffbeb;
              border-left: 3px solid #f59e0b;
              padding: 12px 16px;
              margin: 24px 0;
              border-radius: 4px;
              font-size: 14px;
              color: #92400e;
            }
            .warning strong {
              font-weight: 600;
            }
            .help-text {
              font-size: 14px;
              color: #6b7280;
              margin-top: 24px;
            }
            .footer {
              color: #9ca3af;
              font-size: 13px;
              padding: 20px 32px;
              border-top: 1px solid #f3f4f6;
              background: #fafbfc;
            }
            .footer p {
              margin: 4px 0;
              line-height: 1.5;
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>Welcome to ${fromName}</h1>
            </div>
            
            <div class="content">
              <p class="greeting">Hi ${full_name},</p>
              
              <p class="intro-text">Your account has been successfully created. You can now access the portal using the credentials below.</p>
              
              <div class="credentials-box">
                <h3>Login Credentials</h3>
                
                <p class="credential-line">
                  <strong>Email:</strong> <code>${email}</code>
                </p>
                
                <p class="credential-line">
                  <strong>Password:</strong> <code>${password}</code>
                </p>
                
                <p class="credential-line">
                  <strong>Access Level:</strong> ${rolesDisplay}
                </p>
              </div>
              
              <div class="warning">
                <strong>Security Notice:</strong> Please change your password after your first login.
              </div>
              
              <div class="button-container">
                <a href="${finalPortalUrl}" class="button" style="color: #ffffff !important; background-color: #4F46E5 !important; text-decoration: none;">Access Portal</a>
              </div>
              
              <p class="help-text">If you have any questions or need assistance, please contact your system administrator.</p>
            </div>
            
            <div class="footer">
              <p>This is an automated message. Please do not reply.</p>
              <p>&copy; ${new Date().getFullYear()} ${fromName}. All rights reserved.</p>
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

Portal URL: ${finalPortalUrl}

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
