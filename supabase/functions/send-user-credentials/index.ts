import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

    // Initialize SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: smtpPort === 465,
        auth: {
          username: smtpUser,
          password: smtpPassword,
        },
      },
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
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              border-radius: 10px 10px 0 0;
              text-align: center;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .credentials-box {
              background: white;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              border-left: 4px solid #667eea;
            }
            .credential-item {
              margin: 10px 0;
              padding: 8px 0;
            }
            .credential-label {
              font-weight: bold;
              color: #667eea;
            }
            .credential-value {
              font-family: monospace;
              background: #f3f4f6;
              padding: 5px 10px;
              border-radius: 4px;
              display: inline-block;
              margin-left: 10px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background: #667eea;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
              font-weight: bold;
            }
            .warning {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .footer {
              text-align: center;
              color: #6b7280;
              font-size: 14px;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Welcome to the Portal!</h1>
            <p>Your account has been successfully created</p>
          </div>
          
          <div class="content">
            <p>Hi <strong>${full_name}</strong>,</p>
            
            <p>Welcome! Your account has been created and you can now access the portal system.</p>
            
            <div class="credentials-box">
              <h3>Your Login Credentials</h3>
              
              <div class="credential-item">
                <span class="credential-label">Email:</span>
                <span class="credential-value">${email}</span>
              </div>
              
              <div class="credential-item">
                <span class="credential-label">Temporary Password:</span>
                <span class="credential-value">${password}</span>
              </div>
              
              <div class="credential-item">
                <span class="credential-label">Access Level:</span>
                <span class="credential-value">${rolesDisplay}</span>
              </div>
            </div>
            
            <div class="warning">
              <strong>⚠️ Important Security Notice:</strong><br>
              Please change your password immediately after your first login for security reasons.
            </div>
            
            <center>
              <a href="${portal_url}" class="button">Access Portal</a>
            </center>
            
            <p>If you have any questions or need assistance, please contact your system administrator.</p>
            
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
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

Portal URL: ${portal_url}

If you have any questions or need assistance, please contact your system administrator.

This is an automated message. Please do not reply to this email.

© ${new Date().getFullYear()} ${fromName}. All rights reserved.
    `;

    // Send email
    await client.send({
      from: `${fromName} <${fromEmail}>`,
      to: email,
      subject: `Welcome to ${fromName} - Your Portal Access`,
      content: textContent,
      html: htmlContent,
    });

    await client.close();

    console.log(`Credentials email sent successfully to ${email}`);

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
