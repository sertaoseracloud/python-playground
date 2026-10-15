"""pyspark.ml.linalg: vetores densos e esparsos.

O print do Python mostra os vetores como o PySpark ([1.0,2.0]); o show() mostra como o toString do
Scala (1.0E-5, (4,[1,3],[2.0,1.0])). O Spark devolve arrays do numpy no toArray(); aqui, listas."""
from ...sql import types as T
from ...sql.mostrar import java_double


class VectorUDT(T.UserDefinedType):
    _simples = 'vector'
    _nome = 'vector'

    def aceita(self, valor):
        return isinstance(valor, Vector)


class Vector:
    __UDT__ = VectorUDT()

    def __len__(self):
        return self.size

    def __iter__(self):
        return iter(self.toArray())

    def __eq__(self, outro):
        return isinstance(outro, Vector) and self.size == outro.size and self.toArray() == outro.toArray()

    def __hash__(self):
        return hash((self.size, tuple(self.toArray())))

    @staticmethod
    def _lista(outro):
        return outro.toArray() if isinstance(outro, Vector) else [float(x) for x in outro]

    def dot(self, outro):
        return sum(x * y for x, y in zip(self.toArray(), self._lista(outro)))

    def squared_distance(self, outro):
        return sum((x - y) ** 2 for x, y in zip(self.toArray(), self._lista(outro)))

    def norm(self, p):
        a = self.toArray()
        if p == float('inf'):
            return max((abs(x) for x in a), default=0.0)
        return sum(abs(x) ** p for x in a) ** (1 / p)

    def numNonzeros(self):
        return sum(1 for x in self.toArray() if x != 0)


class DenseVector(Vector):
    def __init__(self, ar):
        self.values = [float(x) for x in ar]

    @property
    def size(self):
        return len(self.values)

    def __getitem__(self, i):
        return self.values[i]

    def toArray(self):
        return list(self.values)

    def __str__(self):
        return '[' + ','.join(str(x) for x in self.values) + ']'

    def __repr__(self):
        return f"DenseVector([{', '.join(repr(x) for x in self.values)}])"

    def _texto_do_spark(self):
        return '[' + ','.join(java_double(x) for x in self.values) + ']'


class SparseVector(Vector):
    def __init__(self, size, *args):
        self.size = int(size)
        if len(args) == 1:
            pares = sorted(args[0].items() if isinstance(args[0], dict) else args[0])
            self.indices, self.values = [int(i) for i, _ in pares], [float(v) for _, v in pares]
        else:
            self.indices, self.values = [int(i) for i in args[0]], [float(v) for v in args[1]]

    def __getitem__(self, i):
        if i < 0:
            i += self.size
        if not 0 <= i < self.size:
            raise IndexError(f'Index {i} out of bounds.')
        return self.values[self.indices.index(i)] if i in self.indices else 0.0

    def toArray(self):
        a = [0.0] * self.size
        for i, v in zip(self.indices, self.values):
            a[i] = v
        return a

    def __str__(self):
        return f"({self.size},[{','.join(map(str, self.indices))}],[{','.join(str(v) for v in self.values)}])"

    def __repr__(self):
        return f"SparseVector({self.size}, {{{', '.join(f'{i}: {v!r}' for i, v in zip(self.indices, self.values))}}})"

    def _texto_do_spark(self):
        return f"({self.size},[{','.join(map(str, self.indices))}],[{','.join(java_double(v) for v in self.values)}])"


class Vectors:
    @staticmethod
    def dense(*elements):
        if len(elements) == 1 and not isinstance(elements[0], (int, float)):
            elements = elements[0]
        return DenseVector(elements)

    @staticmethod
    def sparse(size, *args):
        return SparseVector(size, *args)

    @staticmethod
    def zeros(size):
        return DenseVector([0.0] * size)

    @staticmethod
    def squared_distance(v1, v2):
        return (v1 if isinstance(v1, Vector) else DenseVector(v1)).squared_distance(v2)

    @staticmethod
    def norm(vector, p):
        return (vector if isinstance(vector, Vector) else DenseVector(vector)).norm(p)


def comprimido(valores):
    """Como o Vector.compressed do Spark: esparso quando ocupa menos (1,5 × (nnz + 1) < tamanho)."""
    nnz = sum(1 for v in valores if v != 0)
    if 1.5 * (nnz + 1.0) < len(valores):
        return SparseVector(len(valores), [(i, v) for i, v in enumerate(valores) if v != 0])
    return DenseVector(valores)


__all__ = ['Vector', 'DenseVector', 'SparseVector', 'Vectors', 'VectorUDT']
