\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{virgiling-slides}[2026/09/04 v2.0 Virgiling academic slides]

% Forward unknown options to Beamer and top-align frame content by default.
\DeclareOption*{\PassOptionsToClass{\CurrentOption}{beamer}}
\ProcessOptions\relax
\LoadClass[t]{beamer}

% Typography
\RequirePackage{iftex}
\ifPDFTeX
  \ClassError{virgiling-slides}
    {virgiling-slides requires Tectonic or XeLaTeX}
    {Cambria Math and MD IO are OpenType fonts. Compile with Tectonic or XeLaTeX.}
\fi

\RequirePackage{fontspec}
\PassOptionsToPackage{warnings-off={mathtools-colon,mathtools-overbracket}}{unicode-math}
\RequirePackage{unicode-math}
\usefonttheme{professionalfonts}

\setsansfont{LinBiolinum_R.otf}[
  BoldFont=LinBiolinum_RB.otf,
  ItalicFont=LinBiolinum_RI.otf,
  BoldItalicFont=LinBiolinum_RBO.otf,
  Ligatures=TeX
]

% Cambria Math and MD IO are resolved from system fonts.
\setmathfont{Cambria Math}
\setmonofont{MD IO}[
  BoldFont={MD IO Bold},
  ItalicFont={MD IO Italic},
  BoldItalicFont={MD IO Bold Italic},
  Scale=MatchLowercase
]

% Visual theme and page geometry
\mode<presentation>{
  \useinnertheme[shadow=false]{rounded}
  \usecolortheme{orchid}
  \usecolortheme{whale}
  \useoutertheme[subsection=true]{smoothbars}
}

\setbeamertemplate{navigation symbols}{}
\setbeamersize{
  text margin left=7mm,
  text margin right=7mm,
  mini frame size=.095cm,
  mini frame offset=.025cm
}

\setbeamertemplate{items}[square]

\setbeamerfont{normal text}{size=\normalsize}
\setbeamerfont{title}{size=\Large,series=\bfseries}
\setbeamerfont{subtitle}{size=\normalsize,series=\mdseries}
\setbeamerfont{author}{size=\normalsize}
\setbeamerfont{institute}{size=\small}
\setbeamerfont{date}{size=\small}
\setbeamerfont{frametitle}{size=\fontsize{15}{17}\selectfont,series=\mdseries}
\setbeamerfont{framesubtitle}{size=\small,series=\mdseries}
\setbeamerfont{block title}{size=\normalsize,series=\mdseries}
\setbeamerfont{footnote}{size=\tiny}
\setbeamerfont{section in head/foot}{size=\fontsize{5.4}{5.8}\selectfont,series=\mdseries}
\setbeamerfont{subsection in head/foot}{size=\fontsize{5.2}{5.6}\selectfont,series=\mdseries}
\setbeamerfont{author in head/foot}{size=\fontsize{5}{5.5}\selectfont}
\setbeamerfont{title in head/foot}{size=\fontsize{5}{5.5}\selectfont}
\setbeamerfont{date in head/foot}{size=\fontsize{5}{5.5}\selectfont}

\setbeamercolor{frametitle}{parent=normal text}
\setbeamercolor{framesubtitle}{parent=normal text}

% Keep the subsection band empty; omit the fading seam to avoid nullfont warnings.
\defbeamertemplate*{headline}{virgiling-slides}{%
  \normalfont\sffamily%
  \pgfuseshading{beamer@barshade}%
  \vskip-8.8ex%
  \begin{beamercolorbox}[ignorebg,ht=2.25ex,dp=3.75ex]{section in head/foot}%
    \insertnavigation{\paperwidth}%
  \end{beamercolorbox}%
  \begin{beamercolorbox}[
    ignorebg,
    ht=2.125ex,
    dp=1.125ex,
    leftskip=.3cm,
    rightskip=.3cm plus1fil
  ]{subsection in head/foot}%
  \end{beamercolorbox}%
  \vskip-0.1ex%
}
\setbeamertemplate{headline}[virgiling-slides]

\defbeamertemplate*{frametitle}{virgiling-slides}{%
  \nointerlineskip%
  \begin{beamercolorbox}[
    wd=\paperwidth,
    sep=0pt,
    leftskip=7mm,
    rightskip=7mm
  ]{frametitle}%
    \vskip.85ex%
    \usebeamerfont{frametitle}\strut\insertframetitle\strut\par%
    \ifx\insertframesubtitle\@empty\else%
      \vskip-.25ex%
      {\usebeamerfont{framesubtitle}\insertframesubtitle\strut\par}%
    \fi%
    \vskip.55ex%
  \end{beamercolorbox}%
}
\setbeamertemplate{frametitle}[virgiling-slides]

\defbeamertemplate*{title page}{virgiling-slides}{%
  \vbox{}%
  \vfill%
  \begin{centering}%
    \begin{beamercolorbox}[
      wd=.88\paperwidth,
      sep=.85em,
      center,
      rounded=true,
      shadow=false
    ]{title}%
      \usebeamerfont{title}\inserttitle\par%
      \ifx\insertsubtitle\@empty\else%
        \vskip.35em%
        {\usebeamerfont{subtitle}\insertsubtitle\par}%
      \fi%
    \end{beamercolorbox}%
    \vskip1.25em%
    {\usebeamerfont{author}\insertauthor\par}%
    \ifx\insertinstitute\@empty\else%
      \vskip.85em%
      {\usebeamerfont{institute}\insertinstitute\par}%
    \fi%
    \ifx\insertdate\@empty\else%
      \vskip1.05em%
      {\usebeamerfont{date}\insertdate\par}%
    \fi%
    \ifx\inserttitlegraphic\@empty\else%
      \vskip1em%
      {\usebeamercolor[fg]{titlegraphic}\inserttitlegraphic\par}%
    \fi%
  \end{centering}%
  \vfill%
}
\setbeamertemplate{title page}[virgiling-slides]

% Public footer hooks.
\newcommand{\VirgilingFooterLeft}{%
  \insertshortauthor%
  \ifx\beamer@shortinstitute\@empty\else\; (\insertshortinstitute)\fi
}
\newcommand{\VirgilingFooterCenter}{\insertshorttitle}
\newcommand{\VirgilingFooterRight}{%
  \insertshortdate\hfill\insertframenumber/\inserttotalframenumber
}

\setbeamercolor*{author in head/foot}{parent=palette tertiary}
\setbeamercolor*{title in head/foot}{parent=palette secondary}
\setbeamercolor*{date in head/foot}{parent=palette primary}

\defbeamertemplate*{footline}{virgiling-slides}{%
  \leavevmode%
  \hbox{%
    \begin{beamercolorbox}[
      wd=.32\paperwidth,
      ht=1.8ex,
      dp=.65ex,
      leftskip=1.2ex,
      rightskip=1.2ex
    ]{author in head/foot}%
      \usebeamerfont{author in head/foot}\VirgilingFooterLeft
    \end{beamercolorbox}%
    \begin{beamercolorbox}[
      wd=.42\paperwidth,
      ht=1.8ex,
      dp=.65ex,
      center
    ]{title in head/foot}%
      \usebeamerfont{title in head/foot}\VirgilingFooterCenter
    \end{beamercolorbox}%
    \begin{beamercolorbox}[
      wd=.26\paperwidth,
      ht=1.8ex,
      dp=.65ex,
      leftskip=1.2ex,
      rightskip=1.2ex
    ]{date in head/foot}%
      \usebeamerfont{date in head/foot}\VirgilingFooterRight
    \end{beamercolorbox}%
  }%
  \vskip0pt%
}
\setbeamertemplate{footline}[virgiling-slides]

% Convenience commands
\newcommand{\VirgilingTitleFrame}{%
  \begingroup
    \let\insertnavigation\@gobble
    \maketitle
  \endgroup
}

\newcommand{\VirgilingOutlineFrame}[1][Outline]{%
  \frame{\frametitle{#1}\tableofcontents}%
}

\newcommand{\VirgilingEnableSectionOutlines}[1][Outline]{%
  \AtBeginSection[]{%
    \frame{%
      \frametitle{#1}%
      \tableofcontents[currentsection,hideothersubsections]%
    }%
  }%
}

\mode<all>
\endinput
