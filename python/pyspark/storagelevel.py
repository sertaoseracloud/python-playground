"""Níveis de armazenamento do cache (aqui, tudo fica na memória do processo principal)."""


class StorageLevel:
    def __init__(self, useDisk, useMemory, useOffHeap, deserialized, replication=1):
        self.useDisk, self.useMemory, self.useOffHeap = useDisk, useMemory, useOffHeap
        self.deserialized, self.replication = deserialized, replication

    def __repr__(self):
        return f'StorageLevel({self.useDisk}, {self.useMemory}, {self.useOffHeap}, {self.deserialized}, {self.replication})'

    def __str__(self):
        partes = [p for p, sim in (('Disk', self.useDisk), ('Memory', self.useMemory), ('OffHeap', self.useOffHeap)) if sim]
        return f"{' '.join(partes)} {'Deserialized' if self.deserialized else 'Serialized'} {self.replication}x Replicated"

    def __eq__(self, outro):
        return isinstance(outro, StorageLevel) and repr(self) == repr(outro)

    def __hash__(self):
        return hash(repr(self))


StorageLevel.NONE = StorageLevel(False, False, False, False)
StorageLevel.DISK_ONLY = StorageLevel(True, False, False, False)
StorageLevel.MEMORY_ONLY = StorageLevel(False, True, False, False)
StorageLevel.MEMORY_AND_DISK = StorageLevel(True, True, False, False)
StorageLevel.MEMORY_AND_DISK_DESER = StorageLevel(True, True, False, True)
