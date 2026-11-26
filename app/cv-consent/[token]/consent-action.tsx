'use client';
import { useState } from 'react';
export default function ConsentAction({token,action}:{token:string;action:'consent'|'withdraw'}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  return <form onSubmit={async e=>{
    e.preventDefault(); if(busy)return;setBusy(true);setError('');
    try {
      const response=await fetch('/api/cv-consent/'+encodeURIComponent(token),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
      if(!response.ok){const body=await response.json();throw new Error(body.error || 'ვერ შესრულდა. სცადეთ ხელახლა.');}
      window.location.reload();
    }catch(e){setError(e instanceof Error?e.message:'ვერ შესრულდა.');setBusy(false);}
  }}><button className="primary" type="submit" disabled={busy} style={{minHeight:44,whiteSpace:'normal'}}>{busy?'ინახება…':action==='consent'?'თანხმობას ვაძლევ':'თანხმობის გაუქმება'}</button>{error&&<p role="alert">{error}</p>}</form>;
}
