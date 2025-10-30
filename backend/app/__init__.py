"""
Inicializa o pacote da aplicação.

O backend está organizado em camadas:

* **core**: componentes de infraestrutura (configuração, segurança, logs, multi‑tenancy).
* **models**: definições ORM com SQLAlchemy.
* **schemas**: modelos Pydantic para validação e serialização.
* **crud**: operações de acesso a dados e lógica de negócio.
* **api**: rotas agrupadas por domínio.

Consulte `main.py` para inicializar a aplicação.
"""

__all__ = ["main"]