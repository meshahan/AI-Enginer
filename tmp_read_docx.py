import sys
import docx2txt

def read_docx(path):
    try:
        text = docx2txt.process(path)
        return text
    except Exception as e:
        return str(e)

if __name__ == '__main__':
    if len(sys.argv) > 1:
        print(read_docx(sys.argv[1]))
    else:
        print("Usage: python read_docx.py <path_to_docx>")
