CREATE TABLE tracking_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  settings jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO tracking_settings(id, settings) VALUES (true, $tracking${"topGeId": "118973", "topGeEnabled": true, "googleId": "G-9S8J0W7QXM", "googleEnabled": true, "yandexId": "112737833", "yandexEnabled": true, "customHtml": "<!-- Meta Pixel Code -->\n<script>\n!function(f,b,e,v,n,t,s)\n{if(f.fbq)return;n=f.fbq=function(){n.callMethod?\nn.callMethod.apply(n,arguments):n.queue.push(arguments)};\nif(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';\nn.queue=[];t=b.createElement(e);t.async=!0;\nt.src=v;s=b.getElementsByTagName(e)[0];\ns.parentNode.insertBefore(t,s)}(window, document,'script',\n'https://connect.facebook.net/en_US/fbevents.js');\nfbq('init', '1422360353191134');\nfbq('track', 'PageView');\n</script>\n<noscript><img height=\"1\" width=\"1\" style=\"display:none\"\nsrc=\"https://www.facebook.com/tr?id=1422360353191134&ev=PageView&noscript=1\"\n/></noscript>\n<!-- End Meta Pixel Code -->", "customEnabled": true}$tracking$::jsonb);
