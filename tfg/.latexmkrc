$pdf_mode = 4;  # use lualatex
$lualatex = 'lualatex -interaction=nonstopmode -synctex=1 %O %S';
$bibtex_use = 2;
$biber = 'biber %O %S';
$clean_ext = 'synctex.gz synctex.gz(busy) run.xml bcf fdb_latexmk fls aux log out toc lof lot bbl blg';
