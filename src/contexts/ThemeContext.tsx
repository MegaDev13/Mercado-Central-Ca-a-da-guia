import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';
const ThemeContext = createContext<{theme: Theme, toggle: ()=>void, setTheme:(t:Theme)=>void}>({theme:'dark', toggle:()=>{}, setTheme:()=>{}});

export function ThemeProvider({children}:{children:React.ReactNode}) {
  const [theme, setThemeState] = useState<Theme>(()=>{
    const saved = localStorage.getItem('rpg_theme') as Theme | null;
    if (saved) return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    return 'dark';
  });

  useEffect(()=>{
    localStorage.setItem('rpg_theme', theme);
    document.documentElement.classList.remove('dark','light');
    document.documentElement.classList.add(theme);
  },[theme]);

  const toggle = ()=> setThemeState(t=> t==='dark'?'light':'dark');
  const setTheme = (t:Theme)=> setThemeState(t);

  return <ThemeContext.Provider value={{theme,toggle,setTheme}}>{children}</ThemeContext.Provider>;
}

export const useTheme = ()=> useContext(ThemeContext);
