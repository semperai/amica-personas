.PHONY: amica.pdf all clean

all: amica.pdf

amica.pdf: amica.tex
	latexmk -pdf -pdflatex="pdflatex -interaction=nonstopmode" -use-make amica.tex

clean:
	latexmk -CA
