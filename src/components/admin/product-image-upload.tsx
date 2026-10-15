'use client';

import {useState} from 'react';
import Image from 'next/image';

export function ProductImageUpload({name,path,url,label,help,uploadLabel,workingLabel,errorLabel,acceptLabel}: {
  name:string;path:string;url:string;label:string;help:string;uploadLabel:string;workingLabel:string;errorLabel:string;acceptLabel:string;
}) {
  const [savedPath,setSavedPath]=useState(path);
  const [preview,setPreview]=useState(url);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  async function upload(file:File) {
    setBusy(true);setError('');
    try {
      const body=new FormData();body.set('image',file);
      const response=await fetch('/api/admin/products/images',{method:'POST',body});
      const result=await response.json() as {path?:string;url?:string};
      if(!response.ok||!result.path||!result.url) throw new Error('upload failed');
      setSavedPath(result.path);setPreview(result.url);
    } catch { setError(errorLabel); }
    finally { setBusy(false); }
  }

  return <div className="admin-image-upload">
    <p><strong>{label}</strong></p><input type="hidden" name={name} value={savedPath}/>
    <label>{uploadLabel}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event)=>{const file=event.currentTarget.files?.[0];if(file) void upload(file);}}/></label>
    <p className="admin-help">{acceptLabel} {help}</p>
    {preview&&<Image src={preview} alt="" width={120} height={120} unoptimized style={{objectFit:'cover'}}/>}
    {busy&&<p role="status">{workingLabel}</p>}{error&&<p role="alert" className="admin-error">{error}</p>}
  </div>;
}
